// Shared app state. React components subscribe with `useOffice(selector)`;
// the canvas engine reads it with `useOffice.getState()`.

import { create } from 'zustand';
import {
  COWORKERS, DEFAULT_LOOK, FOODS, INITIAL_TASKS, PROJECTS,
  type Coworker, type FoodId, type Look, type Person, type Project, type Task,
} from './data';
import { insertTask, saveTask, type OfficeData, type Workspace } from './supabase/office';
import { nextTaskId } from './tasks';

export type Mode = 'start' | 'play' | 'dialog' | 'modal';

export interface DialogRequest {
  pages: string[];
  speaker?: string;
  choices?: string[];
  onChoice?: (choice: string) => void;
  onClose?: () => void;
}

export type ModalRequest =
  | { kind: 'board' } | { kind: 'status' } | { kind: 'fridge' } | { kind: 'bookshelf' } | { kind: 'arcade' } | { kind: 'manage-team' } | { kind: 'character' } | { kind: 'person'; id: string } | { kind: 'bot'; id: string };

type FoodCounts = Record<FoodId, number>;
const foodCounts = (count: (id: FoodId) => number) =>
  Object.fromEntries(FOODS.map(f => [f.id, count(f.id)])) as FoodCounts;

interface OfficeState {
  workspace: Workspace | null; // null in demo mode: changes stay in this tab
  coworkers: Coworker[];
  projects: Record<string, Project>;
  started: boolean;
  player: { name: string; look: Look };
  tasks: Task[];
  dialog: (DialogRequest & { id: number }) | null;
  modal: ModalRequest | null;
  teamOpen: boolean;
  zone: string | null;
  zoneTick: number;
  waterCups: number;
  fridge: FoodCounts; // what's left in the fridge
  bag: FoodCounts; // what the player has taken

  load: (office: OfficeData) => void;
  start: (name: string, look: Look) => void;
  setPlayer: (name: string, look: Look) => void;
  drinkWater: () => number;
  takeFood: (id: FoodId) => void;
  putBackFood: (id: FoodId) => void;
  eatFood: (id: FoodId) => void;
  openDialog: (d: DialogRequest) => void;
  closeDialog: () => void;
  openModal: (m: ModalRequest) => void;
  closeModal: () => void;
  toggleTeam: (force?: boolean) => void;
  setZone: (zone: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
}

let dialogSeq = 0;

export const useOffice = create<OfficeState>()((set, get) => ({
  workspace: null,
  coworkers: COWORKERS,
  projects: PROJECTS,
  started: false,
  player: { name: 'You', look: DEFAULT_LOOK },
  tasks: INITIAL_TASKS,
  dialog: null,
  modal: null,
  teamOpen: false,
  zone: null,
  zoneTick: 0,
  waterCups: 0,
  fridge: foodCounts(id => FOODS.find(f => f.id === id)!.stock),
  bag: foodCounts(() => 0),

  load: ({ workspace, coworkers, projects, tasks }) => set({ workspace, coworkers, projects, tasks }),
  start: (name, look) => set({ started: true, player: { name, look } }),
  setPlayer: (name, look) => set({ player: { name, look } }),
  drinkWater: () => {
    const cups = get().waterCups + 1;
    set({ waterCups: cups });
    return cups;
  },
  takeFood: id => set(s => s.fridge[id] > 0
    ? { fridge: { ...s.fridge, [id]: s.fridge[id] - 1 }, bag: { ...s.bag, [id]: s.bag[id] + 1 } }
    : s),
  putBackFood: id => set(s => s.bag[id] > 0
    ? { fridge: { ...s.fridge, [id]: s.fridge[id] + 1 }, bag: { ...s.bag, [id]: s.bag[id] - 1 } }
    : s),
  eatFood: id => set(s => s.bag[id] > 0 ? { bag: { ...s.bag, [id]: s.bag[id] - 1 } } : s),
  openDialog: d => set({ dialog: { ...d, id: ++dialogSeq } }),
  closeDialog: () => {
    const d = get().dialog;
    set({ dialog: null });
    d?.onClose?.();
  },
  openModal: modal => set({ modal }),
  closeModal: () => set({ modal: null }),
  toggleTeam: force => set(s => ({ teamOpen: force ?? !s.teamOpen })),
  setZone: zone => set(s => ({ zone, zoneTick: s.zoneTick + 1 })),

  // Both task actions update the screen first, then save. If saving fails the
  // change is undone, so the board never shows something the database doesn't have.
  updateTask: (id, patch) => {
    const { workspace, tasks } = get();
    const before = tasks.find(t => t.id === id);
    if (!before) return;
    set({ tasks: tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) });
    if (!workspace) return;
    saveTask(workspace, id, patch).catch(err => {
      console.error('Could not save the task:', err.message);
      set(s => ({ tasks: s.tasks.map(t => (t.id === id ? before : t)) }));
    });
  },
  addTask: task => {
    const { workspace, tasks } = get();
    const code = nextTaskId(tasks);
    const created: Task = { ...task, id: workspace ? crypto.randomUUID() : code, code };
    set({ tasks: [...tasks, created] });
    if (!workspace) return;
    insertTask(workspace, created).catch(err => {
      console.error('Could not save the new task:', err.message);
      set(s => ({ tasks: s.tasks.filter(t => t.id !== created.id) }));
    });
  },
}));

export function getMode(s: Pick<OfficeState, 'started' | 'dialog' | 'modal'>): Mode {
  if (!s.started) return 'start';
  if (s.dialog) return 'dialog';
  if (s.modal) return 'modal';
  return 'play';
}

const coworker = (id: string) => useOffice.getState().coworkers.find(c => c.id === id);

// Tasks can be assigned to people without a desk in the office (or to nobody).
const UNKNOWN: Person = { id: '', name: 'Unassigned', role: '', status: 'away' };

export function getPerson(id: string, playerName: string): Person {
  if (id === 'me') return { id: 'me', name: playerName, role: 'You', status: 'online' };
  return coworker(id) ?? { ...UNKNOWN, id };
}

// Claude bots get a chat instead of a task list.
export const isBot = (id: string) => coworker(id)?.bot === true;

export function lookOf(id: string, playerLook: Look): Look {
  return id === 'me' ? playerLook : coworker(id)?.look ?? DEFAULT_LOOK;
}

export function projectOf(id: string, projects: Record<string, Project>): Project {
  return projects[id] ?? { name: 'No project', color: '#7c819c' };
}
