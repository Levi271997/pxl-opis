-- Pxl Opis: the office map got smaller (53x21 -> 37x17), so the demo coworkers
-- move to new desks. Run once in the Supabase SQL editor.
--
-- 1. Move the demo people in workspaces that already exist. People you added
--    yourself keep their spot; the app moves anyone standing in a wall to the
--    nearest free tile.

update public.members m
set desk_x = v.x, desk_y = v.y, wander = v.wander::jsonb
from (values
  ('demo:maya',   3,  8, null),
  ('demo:jordan', 9,  8, null),
  ('demo:priya',  24, 8, null),
  ('demo:sam',    30, 8, null),
  ('demo:alex',   3,  11, null),
  ('demo:lena',   24, 11, null),
  ('demo:omar',   30, 2, null),
  ('demo:tom',    14, 3, '{"x1":10,"y1":1,"x2":26,"y2":5}'),
  ('demo:rosa',   5,  2, '{"x1":1,"y1":1,"x2":8,"y2":5}')
) as v (ref, x, y, wander)
where m.external_ref = v.ref;

-- 2. New workspaces get the new positions too (same function as in the initial
--    migration, only the desk_x / desk_y / wander values changed).

create or replace function public.create_demo_workspace(workspace_name text default 'Pxl Opis HQ')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  select m.workspace_id into ws from public.members m where m.user_id = uid limit 1;
  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name, created_by) values (workspace_name, uid) returning id into ws;

  -- You. external_ref 'demo:*' lets the task insert below find people and projects by key.
  insert into public.members (workspace_id, user_id, display_name, role_title, external_ref)
  values (
    ws, uid,
    coalesce((select p.display_name from public.profiles p where p.id = uid), 'You'),
    'Team lead', 'demo:me'
  );

  insert into public.members
    (workspace_id, display_name, role_title, presence, desk_x, desk_y, home_dir, wander, look, greeting, blocker, external_ref)
  values
    (ws, 'Maya Chen', 'Product Designer', 'online', 3, 8, 'down', null,
     '{"skin":"#f1c27d","hair":"#2b1b17","hairStyle":"long","shirt":"#e0679b","pants":"#34344a"}',
     array['Hi! I''m Maya. I make things look good.', 'The onboarding mockups are almost ready for review.'],
     'Waiting on final copy from Lena for the welcome screens.', 'demo:maya'),
    (ws, 'Jordan Reyes', 'Frontend Dev', 'online', 9, 8, 'down', null,
     '{"skin":"#c68642","hair":"#1a1a1a","hairStyle":"spiky","shirt":"#5b8def","pants":"#2d3047"}',
     array['Yo! Jordan here. Pushing pixels into production.'],
     'Safari keeps breaking the nav. I''m on it, but it''s a fight.', 'demo:jordan'),
    (ws, 'Priya Nair', 'Backend Dev', 'online', 24, 8, 'down', null,
     '{"skin":"#a86b3c","hair":"#111111","hairStyle":"bun","shirt":"#8e6bd8","pants":"#3a3a50"}',
     array['Hey, I''m Priya. If it has an API, I probably wrote it.'],
     'Need a decision on token lifetime before I can finish auth.', 'demo:priya'),
    (ws, 'Sam Okafor', 'QA Engineer', 'online', 30, 8, 'down', null,
     '{"skin":"#ffdbac","hair":"#d9a441","hairStyle":"short","shirt":"#f2a33a","pants":"#4a4e69"}',
     array['Sam, QA. I break things so customers don''t have to.'],
     'Blocked until the Safari fix lands on staging.', 'demo:sam'),
    (ws, 'Alex Kim', 'DevOps', 'busy', 3, 11, 'down', null,
     '{"skin":"#e0ac69","hair":"#7a2e1f","hairStyle":"spiky","shirt":"#3a3f4b","pants":"#22252f"}',
     array['Alex. Keeping the servers alive.'],
     'CI runners are maxed out. Budget approval would help.', 'demo:alex'),
    (ws, 'Lena Fischer', 'Marketing Lead', 'online', 24, 11, 'down', null,
     '{"skin":"#ffe0bd","hair":"#e8c36a","hairStyle":"long","shirt":"#46b5a6","pants":"#3b3355"}',
     array['Lena from marketing! Launch is in three weeks, no pressure.'],
     'Need final screenshots of the app for the launch emails.', 'demo:lena'),
    (ws, 'Omar Haddad', 'Project Manager', 'online', 30, 2, 'down', null,
     '{"skin":"#8d5524","hair":"#1b1b1b","hairStyle":"short","shirt":"#f4f4f4","pants":"#2b2d42"}',
     array['Welcome to my office. Grab a seat.', 'I keep the roadmap honest. Let''s talk priorities.'],
     'Two teams want the same sprint. Classic.', 'demo:omar'),
    (ws, 'Tom Becker', 'Data Analyst', 'away', 14, 3, 'down', '{"x1":10,"y1":1,"x2":26,"y2":5}',
     '{"skin":"#f5c9a0","hair":"#6b4226","hairStyle":"short","shirt":"#d64545","pants":"#3a3a50"}',
     array['Oh, hey! Just on a lunch break.', 'The funnel numbers look interesting, by the way.'],
     'Event names are a mess. Half the dashboard is guesswork.', 'demo:tom'),
    (ws, 'Rosa Lindqvist', 'UX Researcher', 'online', 5, 2, 'down', '{"x1":1,"y1":1,"x2":8,"y2":5}',
     '{"skin":"#fbd3b4","hair":"#b5452b","hairStyle":"bun","shirt":"#9be37a","pants":"#2d3047"}',
     array['Hi! Prepping the room for user interviews.'],
     'Still recruiting two more participants for Thursday.', 'demo:rosa');

  insert into public.projects (workspace_id, name, color, external_ref) values
    (ws, 'Website Redesign', '#4f7fe0', 'demo:web'),
    (ws, 'Mobile App v2', '#d4508a', 'demo:app'),
    (ws, 'Q4 Launch', '#d97a12', 'demo:q4');

  insert into public.tasks (workspace_id, project_id, assignee_id, code, title, status, priority, due_date)
  select ws, p.id, m.id, t.code, t.title, t.status, t.priority, current_date + t.due_in
  from (values
    ('T-101', 'app', 'maya',   'Onboarding flow hi-fi mockups',      'doing',  'high', 2),
    ('T-102', 'web', 'maya',   'Dark mode design tokens',            'review', 'med',  4),
    ('T-103', 'q4',  'maya',   'Icon set for launch landing page',   'todo',   'low',  10),
    ('T-111', 'web', 'jordan', 'Build new pricing page',             'doing',  'high', 3),
    ('T-112', 'web', 'jordan', 'Fix nav overflow on Safari',         'todo',   'med',  -1),
    ('T-113', 'app', 'jordan', 'Implement onboarding screens',       'todo',   'high', 8),
    ('T-121', 'app', 'priya',  'Auth service: refresh tokens',       'doing',  'high', 2),
    ('T-122', 'web', 'priya',  'Rate limiting on public API',        'review', 'med',  3),
    ('T-123', 'app', 'priya',  'Move cron jobs to a queue',          'done',   'low',  -3),
    ('T-131', 'web', 'sam',    'Regression suite for checkout',      'doing',  'med',  5),
    ('T-132', 'app', 'sam',    'Test plan for app v2 beta',          'todo',   'high', 6),
    ('T-133', 'web', 'sam',    'Verify Safari nav fix',              'todo',   'low',  4),
    ('T-141', 'app', 'alex',   'Staging environment for app v2',     'done',   'high', -5),
    ('T-142', 'web', 'alex',   'Cut CI build time under 6 min',      'doing',  'med',  7),
    ('T-143', 'q4',  'alex',   'Uptime alerts for launch day',       'todo',   'med',  12),
    ('T-151', 'q4',  'lena',   'Launch email sequence (3 emails)',   'doing',  'high', 5),
    ('T-152', 'q4',  'lena',   'Product Hunt assets',                'todo',   'med',  14),
    ('T-153', 'q4',  'lena',   'Customer case study: Acme Corp',     'review', 'low',  6),
    ('T-161', 'q4',  'omar',   'Q4 roadmap review',                  'review', 'high', 1),
    ('T-162', 'app', 'omar',   'Sprint 14 planning',                 'todo',   'med',  3),
    ('T-163', 'web', 'omar',   'Stakeholder update deck',            'done',   'med',  -2),
    ('T-171', 'q4',  'tom',    'Funnel dashboard for launch',        'doing',  'med',  9),
    ('T-172', 'app', 'tom',    'Clean up event tracking names',      'todo',   'low',  15),
    ('T-191', 'web', 'rosa',   'Usability test: new checkout',       'doing',  'high', 2),
    ('T-192', 'app', 'rosa',   'Synthesize interview notes',         'review', 'med',  4),
    ('T-181', 'app', 'me',     'Review Maya''s onboarding mockups',  'todo',   'high', 1),
    ('T-182', 'app', 'me',     'Write release notes for v2 beta',    'todo',   'med',  6),
    ('T-183', 'q4',  'me',     'Approve Q4 CI budget',               'doing',  'high', 0)
  ) as t (code, proj, who, title, status, priority, due_in)
  join public.projects p on p.workspace_id = ws and p.external_ref = 'demo:' || t.proj
  join public.members m on m.workspace_id = ws and m.external_ref = 'demo:' || t.who;

  return ws;
end;
$$;

revoke all on function public.create_demo_workspace(text) from public, anon;
grant execute on function public.create_demo_workspace(text) to authenticated;
