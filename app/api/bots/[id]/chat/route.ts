// Chat with a bot: saves your message, asks Claude with the recent
// conversation, streams the reply back as plain text, then saves the reply.
// Runs as the signed-in user, so database rules decide what they can reach.

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse, type NextRequest } from 'next/server';
import { BOT_MODELS, DEFAULT_DAILY_LIMIT, HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from '@/lib/bots';
import { createClient } from '@/lib/supabase/server';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

function startOfUtcDay() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, 'Bots are not set up yet: add ANTHROPIC_API_KEY to .env.local.');

  const body = await request.json().catch(() => null);
  const message = String(body?.message ?? '').trim();
  if (!message) return fail(400, 'Type a message first.');
  if (message.length > MAX_MESSAGE_LENGTH) return fail(400, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, 'Sign in to chat with bots.');

  // Only bots in a workspace you belong to are visible here.
  const { id } = await params;
  const { data: bot } = await supabase
    .from('bots')
    .select('id, workspace_id, name, role_title, instructions, model')
    .eq('id', id)
    .maybeSingle();
  if (!bot) return fail(404, 'That bot isn\'t in your office.');

  const limit = Number(process.env.BOT_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const { count } = await supabase
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', startOfUtcDay());
  const used = count ?? 0;
  if (used >= limit) return fail(429, `You've used all ${limit} bot messages for today. They reset at midnight UTC.`);

  const { data: recent } = await supabase
    .from('bot_messages')
    .select('role, content')
    .eq('bot_id', bot.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_MESSAGES);
  const history = (recent ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];
  while (history[0]?.role === 'assistant') history.shift(); // the conversation must start with the user

  const { error: saveError } = await supabase
    .from('bot_messages')
    .insert({ bot_id: bot.id, workspace_id: bot.workspace_id, user_id: user.id, role: 'user', content: message });
  if (saveError) return fail(500, 'Could not save your message.');

  const { data: me } = await supabase
    .from('members')
    .select('display_name')
    .eq('workspace_id', bot.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  // Stable first (cached between messages), then who is asking.
  const system = [
    {
      type: 'text' as const,
      text: `You are ${bot.name}, ${bot.role_title}, an AI coworker in Pxl Opis, a project management app shaped like a pixel-art office. `
        + 'Teammates walk up to your desk and chat with you. Reply in plain text (no Markdown headings or tables), '
        + 'conversationally and briefly unless asked for detail.\n\n'
        + (bot.instructions || ''),
      cache_control: { type: 'ephemeral' as const },
    },
    { type: 'text' as const, text: `You're talking with ${me?.display_name ?? 'a teammate'}.` },
  ];
  const model = (BOT_MODELS as readonly string[]).includes(bot.model) ? bot.model : BOT_MODELS[0];

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = '';
      try {
        const claude = client.beta.messages.stream({
          model,
          max_tokens: 8000,
          output_config: { effort: 'low' }, // chat: quick, short answers
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default', // if a reply is declined, let the API retry on another model
          system,
          messages: [...history, { role: 'user', content: message }],
        });
        claude.on('text', text => {
          reply += text;
          controller.enqueue(encoder.encode(text));
        });
        const final = await claude.finalMessage();
        if (final.stop_reason === 'refusal' && !reply) {
          reply = 'Sorry, I can\'t help with that one.';
          controller.enqueue(encoder.encode(reply));
        }
        if (reply) {
          await supabase.from('bot_messages').insert({
            bot_id: bot.id, workspace_id: bot.workspace_id, user_id: user.id, role: 'assistant', content: reply.slice(0, 20000),
            input_tokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0),
            output_tokens: final.usage.output_tokens,
          });
        }
      } catch (err) {
        const why = err instanceof Anthropic.RateLimitError ? 'I\'m getting too many questions right now. Try again in a minute.'
          : err instanceof Anthropic.AuthenticationError ? 'My API key isn\'t working. Check ANTHROPIC_API_KEY in .env.local.'
          : err instanceof Anthropic.APIError ? `Something went wrong talking to Claude (${err.status}).`
          : 'Something went wrong.';
        console.error('Bot chat failed:', err);
        controller.enqueue(encoder.encode(`${reply ? '\n\n' : ''}[${why}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Messages-Left': String(Math.max(0, limit - used - 1)),
    },
  });
}
