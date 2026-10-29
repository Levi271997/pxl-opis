// The connectors shown in Settings. Safe for the browser: no URLs with
// secrets, no keys. The sign-in details live in lib/connectors/oauth.ts.

export type ConnectorId = 'monday' | 'clickup' | 'github';
export type Use = 'board' | 'bots';

export interface Connector {
  id: ConnectorId;
  name: string;
  description: string;
  color: string;
  uses: Use[];
}

export const CONNECTORS: Connector[] = [
  {
    id: 'monday', name: 'Monday.com', color: '#ff3d57', uses: ['board', 'bots'],
    description: 'Bring boards, items and people into the office as projects, tasks and teammates.',
  },
  {
    id: 'clickup', name: 'ClickUp', color: '#7b68ee', uses: ['board', 'bots'],
    description: 'Sync lists and tasks from your ClickUp workspace onto the board.',
  },
  {
    id: 'github', name: 'GitHub', color: '#24292f', uses: ['board', 'bots'],
    description: 'Show issues as tasks, and let bots look at repos, issues and pull requests.',
  },
];

// Shown greyed out, so people can see what's planned.
export const COMING_SOON = [
  { name: 'Jira', color: '#0052cc' },
  { name: 'Trello', color: '#0079bf' },
  { name: 'Asana', color: '#f06a6a' },
  { name: 'Slack', color: '#4a154b' },
  { name: 'Google Drive', color: '#1fa463' },
  { name: 'Notion', color: '#111111' },
];

export const USE_LABELS: Record<Use, string> = { board: 'Board sync', bots: 'Bot tools' };

export const isConnectorId = (id: string): id is ConnectorId => CONNECTORS.some(c => c.id === id);
