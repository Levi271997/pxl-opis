// Shared app state. React components subscribe with `useOffice(selector)`;
// the canvas engine reads it with `useOffice.getState()`.

import { create } from 'zustand';
import { COWORKERS, DEFAULT_LOOK, FOODS, INITIAL_TASKS, type FoodId, type Look, type Person, type Task } from './data';
import { nextTaskId } from './tasks';

export type Mode = 'start' | 'play' | 'dialog' | 'modal';

export interface DialogRequest {
  pages: string[];
  speaker?: string;
  choices?: string[];
  onChoice?: (choice: string) => void;
  onClose?: () => void;
}

export type ModalRequest = { kind: 'board' } | { kind: 'status' } | { kind: 'fridge' } | { kind: 'person'; id: string };

type FoodCounts = Record<FoodId, number>;
const foodCounts = (count: (id: FoodId) => number) =>
  Object.fromEntries(FOODS.map(f => [f.id, count(f.id)])) as FoodCounts;

interface OfficeState {
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

  start: (name: string, look: Look) => void;
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

  start: (name, look) => set({ started: true, player: { name, look } }),
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
  updateTask: (id, patch) => set(s => ({ tasks: s.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
  addTask: task => set(s => ({ tasks: [...s.tasks, { ...task, id: nextTaskId(s.tasks) }] })),
}));

export function getMode(s: Pick<OfficeState, 'started' | 'dialog' | 'modal'>): Mode {
  if (!s.started) return 'start';
  if (s.dialog) return 'dialog';
  if (s.modal) return 'modal';
  return 'play';
}

export function getPerson(id: string, playerName: string): Person {
  if (id === 'me') return { id: 'me', name: playerName, role: 'You', status: 'online' };
  return COWORKERS.find(c => c.id === id)!;
}

export function lookOf(id: string, playerLook: Look): Look {
  return id === 'me' ? playerLook : COWORKERS.find(c => c.id === id)!.look;
}
