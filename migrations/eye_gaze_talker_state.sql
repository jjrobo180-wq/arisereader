-- Per-child talker pictures, family buttons, and parent-recorded vocabulary progress.
-- The application authenticates families through its own sessions, so only the
-- server's service role may access this table through Supabase's Data API.
create table if not exists public.eye_gaze_talker_state (
  student_id bigint primary key references public.users(id) on delete cascade,
  config jsonb not null default '{"alwaysHere":null,"pictures":{}}'::jsonb,
  progress jsonb not null default '{"words":{},"history":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint eye_gaze_talker_config_object check (jsonb_typeof(config) = 'object'),
  constraint eye_gaze_talker_progress_object check (jsonb_typeof(progress) = 'object')
);

alter table public.eye_gaze_talker_state enable row level security;
revoke all on public.eye_gaze_talker_state from anon, authenticated;
grant select, insert, update, delete on public.eye_gaze_talker_state to service_role;

create policy "server manages private talker state"
  on public.eye_gaze_talker_state for all to service_role
  using (true) with check (true);
