// Static demo data — no backend yet. Later, load these from an API / database.

export type Dir = 'up' | 'down' | 'left' | 'right';
export type StatusId = 'todo' | 'doing' | 'review' | 'done';
export type Priority = 'high' | 'med' | 'low';
export type ProjectId = 'web' | 'app' | 'q4';
export type Presence = 'online' | 'busy' | 'away';
export type HairStyle = 'short' | 'long' | 'bun' | 'spiky';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  status: Presence;
}

export interface Coworker extends Person {
  x: number;
  y: number;
  dir: Dir;
  wander?: { x1: number; y1: number; x2: number; y2: number };
  look: Look;
  greeting: string[];
  blocker: string;
}

export interface Task {
  id: string;
  title: string;
  project: ProjectId;
  assignee: string; // coworker id, or 'me' for the player
  status: StatusId;
  priority: Priority;
  dueIn: number; // days from today (negative = overdue), so the demo never goes stale
}

export const PROJECTS: Record<ProjectId, { name: string; color: string }> = {
  web: { name: 'Website Redesign', color: '#4f7fe0' },
  app: { name: 'Mobile App v2', color: '#d4508a' },
  q4: { name: 'Q4 Launch', color: '#d97a12' },
};

export const STATUSES: { id: StatusId; label: string; color: string }[] = [
  { id: 'todo', label: 'To do', color: '#7c819c' },
  { id: 'doing', label: 'In progress', color: '#4f7fe0' },
  { id: 'review', label: 'Review', color: '#d97a12' },
  { id: 'done', label: 'Done', color: '#2f9e6e' },
];

export const PRIORITY: Record<Priority, { label: string; icon: string; rank: number }> = {
  high: { label: 'High', icon: '▲', rank: 0 },
  med: { label: 'Medium', icon: '■', rank: 1 },
  low: { label: 'Low', icon: '▼', rank: 2 },
};

export const PRESENCE: Record<Presence, { label: string; color: string }> = {
  online: { label: 'Online', color: '#4ade80' },
  busy: { label: 'Focus mode', color: '#f87171' },
  away: { label: 'Away', color: '#facc15' },
};

export const PLAYER_START = { x: 20, y: 16 };
export const DEFAULT_LOOK: Look = { skin: '#e8b58a', hair: '#5a3825', hairStyle: 'short', shirt: '#3fb27f', pants: '#2d3047' };

export const COWORKERS: Coworker[] = [
  {
    id: 'maya', name: 'Maya Chen', role: 'Product Designer', status: 'online', x: 4, y: 10, dir: 'down',
    look: { skin: '#f1c27d', hair: '#2b1b17', hairStyle: 'long', shirt: '#e0679b', pants: '#34344a' },
    greeting: ["Hi! I'm Maya. I make things look good.", 'The onboarding mockups are almost ready for review.'],
    blocker: 'Waiting on final copy from Lena for the welcome screens.',
  },
  {
    id: 'jordan', name: 'Jordan Reyes', role: 'Frontend Dev', status: 'online', x: 11, y: 10, dir: 'down',
    look: { skin: '#c68642', hair: '#1a1a1a', hairStyle: 'spiky', shirt: '#5b8def', pants: '#2d3047' },
    greeting: ['Yo! Jordan here. Pushing pixels into production.'],
    blocker: "Safari keeps breaking the nav. I'm on it, but it's a fight.",
  },
  {
    id: 'priya', name: 'Priya Nair', role: 'Backend Dev', status: 'online', x: 28, y: 10, dir: 'down',
    look: { skin: '#a86b3c', hair: '#111111', hairStyle: 'bun', shirt: '#8e6bd8', pants: '#3a3a50' },
    greeting: ["Hey, I'm Priya. If it has an API, I probably wrote it."],
    blocker: 'Need a decision on token lifetime before I can finish auth.',
  },
  {
    id: 'sam', name: 'Sam Okafor', role: 'QA Engineer', status: 'online', x: 35, y: 10, dir: 'down',
    look: { skin: '#ffdbac', hair: '#d9a441', hairStyle: 'short', shirt: '#f2a33a', pants: '#4a4e69' },
    greeting: ["Sam, QA. I break things so customers don't have to."],
    blocker: 'Blocked until the Safari fix lands on staging.',
  },
  {
    id: 'alex', name: 'Alex Kim', role: 'DevOps', status: 'busy', x: 4, y: 14, dir: 'down',
    look: { skin: '#e0ac69', hair: '#7a2e1f', hairStyle: 'spiky', shirt: '#3a3f4b', pants: '#22252f' },
    greeting: ['Alex. Keeping the servers alive.'],
    blocker: 'CI runners are maxed out. Budget approval would help.',
  },
  {
    id: 'lena', name: 'Lena Fischer', role: 'Marketing Lead', status: 'online', x: 28, y: 14, dir: 'down',
    look: { skin: '#ffe0bd', hair: '#e8c36a', hairStyle: 'long', shirt: '#46b5a6', pants: '#3b3355' },
    greeting: ['Lena from marketing! Launch is in three weeks, no pressure.'],
    blocker: 'Need final screenshots of the app for the launch emails.',
  },
  {
    id: 'omar', name: 'Omar Haddad', role: 'Project Manager', status: 'online', x: 30, y: 2, dir: 'down',
    look: { skin: '#8d5524', hair: '#1b1b1b', hairStyle: 'short', shirt: '#f4f4f4', pants: '#2b2d42' },
    greeting: ['Welcome to my office. Grab a seat.', "I keep the roadmap honest. Let's talk priorities."],
    blocker: 'Two teams want the same sprint. Classic.',
  },
  {
    id: 'tom', name: 'Tom Becker', role: 'Data Analyst', status: 'away', x: 20, y: 4, dir: 'down',
    wander: { x1: 14, y1: 2, x2: 25, y2: 7 },
    look: { skin: '#f5c9a0', hair: '#6b4226', hairStyle: 'short', shirt: '#d64545', pants: '#3a3a50' },
    greeting: ['Oh, hey! Just on a coffee break.', 'The funnel numbers look interesting, by the way.'],
    blocker: 'Event names are a mess. Half the dashboard is guesswork.',
  },
  {
    id: 'rosa', name: 'Rosa Lindqvist', role: 'UX Researcher', status: 'online', x: 6, y: 6, dir: 'down',
    wander: { x1: 1, y1: 2, x2: 12, y2: 7 },
    look: { skin: '#fbd3b4', hair: '#b5452b', hairStyle: 'bun', shirt: '#9be37a', pants: '#2d3047' },
    greeting: ['Hi! Prepping the room for user interviews.'],
    blocker: 'Still recruiting two more participants for Thursday.',
  },
];

export const INITIAL_TASKS: Task[] = [
  { id: 'T-101', title: 'Onboarding flow hi-fi mockups', project: 'app', assignee: 'maya', status: 'doing', priority: 'high', dueIn: 2 },
  { id: 'T-102', title: 'Dark mode design tokens', project: 'web', assignee: 'maya', status: 'review', priority: 'med', dueIn: 4 },
  { id: 'T-103', title: 'Icon set for launch landing page', project: 'q4', assignee: 'maya', status: 'todo', priority: 'low', dueIn: 10 },
  { id: 'T-111', title: 'Build new pricing page', project: 'web', assignee: 'jordan', status: 'doing', priority: 'high', dueIn: 3 },
  { id: 'T-112', title: 'Fix nav overflow on Safari', project: 'web', assignee: 'jordan', status: 'todo', priority: 'med', dueIn: -1 },
  { id: 'T-113', title: 'Implement onboarding screens', project: 'app', assignee: 'jordan', status: 'todo', priority: 'high', dueIn: 8 },
  { id: 'T-121', title: 'Auth service: refresh tokens', project: 'app', assignee: 'priya', status: 'doing', priority: 'high', dueIn: 2 },
  { id: 'T-122', title: 'Rate limiting on public API', project: 'web', assignee: 'priya', status: 'review', priority: 'med', dueIn: 3 },
  { id: 'T-123', title: 'Move cron jobs to a queue', project: 'app', assignee: 'priya', status: 'done', priority: 'low', dueIn: -3 },
  { id: 'T-131', title: 'Regression suite for checkout', project: 'web', assignee: 'sam', status: 'doing', priority: 'med', dueIn: 5 },
  { id: 'T-132', title: 'Test plan for app v2 beta', project: 'app', assignee: 'sam', status: 'todo', priority: 'high', dueIn: 6 },
  { id: 'T-133', title: 'Verify Safari nav fix', project: 'web', assignee: 'sam', status: 'todo', priority: 'low', dueIn: 4 },
  { id: 'T-141', title: 'Staging environment for app v2', project: 'app', assignee: 'alex', status: 'done', priority: 'high', dueIn: -5 },
  { id: 'T-142', title: 'Cut CI build time under 6 min', project: 'web', assignee: 'alex', status: 'doing', priority: 'med', dueIn: 7 },
  { id: 'T-143', title: 'Uptime alerts for launch day', project: 'q4', assignee: 'alex', status: 'todo', priority: 'med', dueIn: 12 },
  { id: 'T-151', title: 'Launch email sequence (3 emails)', project: 'q4', assignee: 'lena', status: 'doing', priority: 'high', dueIn: 5 },
  { id: 'T-152', title: 'Product Hunt assets', project: 'q4', assignee: 'lena', status: 'todo', priority: 'med', dueIn: 14 },
  { id: 'T-153', title: 'Customer case study: Acme Corp', project: 'q4', assignee: 'lena', status: 'review', priority: 'low', dueIn: 6 },
  { id: 'T-161', title: 'Q4 roadmap review', project: 'q4', assignee: 'omar', status: 'review', priority: 'high', dueIn: 1 },
  { id: 'T-162', title: 'Sprint 14 planning', project: 'app', assignee: 'omar', status: 'todo', priority: 'med', dueIn: 3 },
  { id: 'T-163', title: 'Stakeholder update deck', project: 'web', assignee: 'omar', status: 'done', priority: 'med', dueIn: -2 },
  { id: 'T-171', title: 'Funnel dashboard for launch', project: 'q4', assignee: 'tom', status: 'doing', priority: 'med', dueIn: 9 },
  { id: 'T-172', title: 'Clean up event tracking names', project: 'app', assignee: 'tom', status: 'todo', priority: 'low', dueIn: 15 },
  { id: 'T-191', title: 'Usability test: new checkout', project: 'web', assignee: 'rosa', status: 'doing', priority: 'high', dueIn: 2 },
  { id: 'T-192', title: 'Synthesize interview notes', project: 'app', assignee: 'rosa', status: 'review', priority: 'med', dueIn: 4 },
  { id: 'T-181', title: "Review Maya's onboarding mockups", project: 'app', assignee: 'me', status: 'todo', priority: 'high', dueIn: 1 },
  { id: 'T-182', title: 'Write release notes for v2 beta', project: 'app', assignee: 'me', status: 'todo', priority: 'med', dueIn: 6 },
  { id: 'T-183', title: 'Approve Q4 CI budget', project: 'q4', assignee: 'me', status: 'doing', priority: 'high', dueIn: 0 },
];

export const ANNOUNCEMENTS = [
  'Sprint 14 review is Thursday at 2 PM in the Meeting Room.',
  'Q4 Launch is three weeks out. Check the board in the Meeting Room!',
  'Friday: pizza in the kitchen. Tom is ordering.',
];
