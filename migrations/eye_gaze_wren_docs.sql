-- Wren (the AI-voice talker inside Eye Gazer): each child's boards, settings, learned words and
-- added pictures, saved as a few named documents per child. Only the server's service role may
-- read or write it, like eye_gaze_talker_state.
create table if not exists public.eye_gaze_wren_docs (
  student_id bigint not null references public.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, name),
  constraint eye_gaze_wren_docs_name check (name ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint eye_gaze_wren_docs_object check (jsonb_typeof(data) = 'object')
);

alter table public.eye_gaze_wren_docs enable row level security;
revoke all on public.eye_gaze_wren_docs from anon, authenticated;
grant select, insert, update, delete on public.eye_gaze_wren_docs to service_role;

create policy "server manages private wren docs"
  on public.eye_gaze_wren_docs for all to service_role
  using (true) with check (true);
