# Plan: Claude bots in the office

Status: **idea, not started.** Discussed 2026-10-29. Nothing is built yet; decide
the open questions below first.

## The idea

Besides real employees walking around as players, the office should have **bots**
powered by Claude. The original wish was to show your individual Claude chats
(claude.ai chats and Cowork sessions) as bots inside Pxl Opis.

## The constraint

There is no public API for listing or reading your claude.ai conversations, as far
as we know. Those chats live inside claude.ai, so they can't be mirrored live into
another app. The options below are the realistic ways to get close.

## Options

### A. AI coworkers built on the Claude API (recommended first step)

Each bot is a coworker NPC with its own desk, avatar, name and role, for example
"Ada, Research Assistant" or "Quill, Writer".

- Walk up and press **E** to open a chat panel: a Claude conversation inside the
  office.
- Each bot keeps its own conversation history in Supabase, so each one feels like
  a separate Claude chat.
- Bots can be given tools for Pxl Opis: read the board, create tasks, update
  statuses, write summaries.
- They appear on the Status board, Team list and task cards like real people,
  marked as bots.

What it needs:

- An Anthropic API key, on the server only (never a `NEXT_PUBLIC_` variable).
- Usage limits, since API calls are paid per use.
- New tables: bots (name, role, look, desk, instructions) and bot conversations /
  messages, with RLS like the rest of the workspace.
- A server route that calls the Claude API (streaming replies into the chat panel).
- Check the current Claude models and API features before building.

### B. Your real Claude chats come to the office (later)

Turn Pxl Opis into an **MCP server** (the connector format claude.ai and Cowork
use). Add it as a connector in claude.ai, and any chat or Cowork session can read
and update your board. While a Claude session is using it, that session appears in
the office as a bot at a desk.

- Closest to "my Claude chats as bots": your real sessions working on your real
  tasks.
- Bigger build: needs the app deployed publicly (not localhost), OAuth, and
  security work. Bots only appear while a chat is actively using the connector.

### C. Import exported chats (optional)

claude.ai can export your data. Those conversations could be imported as
read-only bots, or as starting points for new bot conversations. A one-time, manual
snapshot, not live.

## Recommendation

1. Build **A** first: fully under our control, works locally, makes the office
   feel alive.
2. Add **B** once the app is deployed somewhere public, so claude.ai and Cowork
   sessions can join the same office.
3. Skip **C** unless there are specific chats worth preserving.

## Open questions (answer before building A)

1. **Purpose:** should bots mostly chat and help, or also act on the board
   (create tasks, assign work, update statuses)?
2. **Who creates them:** a fixed set of bots, or can admins create bots with their
   own name, role and instructions?
3. **Visibility:** is a conversation with a bot private to each person, or shared
   with the whole team?
4. **Cost:** is paying for API usage okay, and should there be a daily cap per
   person or per team?
