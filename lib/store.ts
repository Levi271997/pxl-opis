// Shared app state. React components subscribe with `useOffice(selector)`;
// the canvas engine reads it with `useOffice.getState()`.

import { create } from 'zustand';
import { COWORKERS, DEFAULT_LOOK, INITIAL_TASKS, type Look, type Person, type Task } from './data';
import { nextTaskId } from './tasks';

export type Mode = 'start' | 'play' | 'dialog' | 'modal';

export interface DialogRequest {
  pages: string[];
  speaker?: string;
  choices?: string[];
  onChoice?: (choice: string) => void;
  onClose?: () => void;
}

export type ModalRequest = { kind: 'board' } | { kind: 'person'; id: string };

interface OfficeState {
  started: boolean;
  player: { name: string; look: Look };
  tasks: Task[];
  dialog: (DialogRequest & { id: number }) | null;
  modal: ModalRequest | null;
  teamOpen: boolean;
  zone: string | null;
  zoneTick: number;

  start: (name: string, look: Look) => void;
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

  start: (name, look) => set({ started: true, player: { name, look } }),
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
