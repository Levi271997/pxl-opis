import type { Look } from '../data';

// The signed-in user, as the UI needs it. null in demo mode or when signed out.
export interface Account {
  id: string;
  email: string;
  name: string;
  look: Look | null; // saved avatar, null until they've entered the office once
}
