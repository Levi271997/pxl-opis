// Settings shared by the bot chat route and the chat panel.

// Messages each person can send to bots per day (UTC), to keep API costs in
// check. Override with BOT_DAILY_LIMIT in .env.local.
export const DEFAULT_DAILY_LIMIT = 50;

export const MAX_MESSAGE_LENGTH = 2000;

// How much earlier conversation is sent to Claude with each new message.
export const HISTORY_MESSAGES = 30;

// Models a bot may use. Anything else in the database falls back to the first.
export const BOT_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;
