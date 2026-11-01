-- Arise Notes (shared/ariseNotes.ts, server/ariseNotes.ts): the AI note taker.
-- Every table is reached only through the server with the service role: row level security is on
-- with no policies, so nobody can read these rows with the public key. Each route checks that the
-- note belongs to the person asking.

-- Minutes for the month, settings and the Family invite code, one row per person.
create table if not exists public.arise_notes_accounts (
  user_id integer primary key,
  period date not null default date_trunc('month', now() at time zone 'utc')::date,
  used integer not null default 0,      -- minutes used from this person's pool (the Family owner's row holds the family's)
  own integer not null default 0,       -- minutes this person transcribed themselves (the 3,000 safety cap)
  rollover integer not null default 0,  -- minutes carried in from last month
  warned smallint not null default 0,   -- 0, 80 or 100: the last warning sent this month
  settings jsonb not null default '{}'::jsonb,
  family_code text unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.arise_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id integer not null,
  title text not null default '',
  template text not null default 'general',
  source text not null default 'record',          -- record | upload | memo
  status text not null default 'recording',       -- recording | processing | ready | no_minutes | failed
  duration_secs double precision not null default 0,
  charged_secs double precision not null default 0,
  charged_minutes integer not null default 0,
  highlights jsonb not null default '[]'::jsonb,   -- seconds the person marked while recording
  speakers jsonb not null default '{}'::jsonb,     -- {"1": "Ms. Lee"}
  summary jsonb,                                    -- {template, hash, at, data}
  extras jsonb not null default '{}'::jsonb,        -- parent emails, translations, study tools, memo idea
  folder text not null default '',
  tags text[] not null default '{}',
  transcript text not null default '',
  audio_keep text not null default 'delete',       -- delete | 30d | keep
  share_token text,
  share_on boolean not null default false,
  family_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tsv tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(transcript, ''))) stored
);
create index if not exists arise_notes_owner_idx on public.arise_notes (owner_id, created_at desc);
create index if not exists arise_notes_tsv_idx on public.arise_notes using gin (tsv);
create unique index if not exists arise_notes_share_idx on public.arise_notes (share_token) where share_token is not null;

-- The audio comes in pieces (a live recording every few minutes, an upload cut on the device).
create table if not exists public.arise_notes_pieces (
  note_id uuid not null references public.arise_notes(id) on delete cascade,
  idx integer not null,
  owner_id integer not null,
  start_secs double precision not null default 0,
  secs double precision not null default 0,
  ext text not null default 'webm',
  state text not null default 'new',              -- new | done | stored | no_minutes | failed
  path text,                                       -- the audio in storage, while it is kept
  provider text not null default '',
  error text not null default '',
  bytes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (note_id, idx)
);
create index if not exists arise_notes_pieces_owner_idx on public.arise_notes_pieces (owner_id);

create table if not exists public.arise_notes_segments (
  note_id uuid not null references public.arise_notes(id) on delete cascade,
  idx integer not null,
  owner_id integer not null,
  start_s double precision not null,
  end_s double precision not null,
  speaker text,
  text text not null,
  tsv tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  primary key (note_id, idx)
);
create index if not exists arise_notes_segments_owner_idx on public.arise_notes_segments (owner_id);
create index if not exists arise_notes_segments_tsv_idx on public.arise_notes_segments using gin (tsv);

create table if not exists public.arise_notes_actions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.arise_notes(id) on delete cascade,
  owner_id integer not null,
  text text not null,
  who text not null default '',
  due date,
  sent_to text,                                    -- life | work, once added to the planner
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arise_notes_actions_note_idx on public.arise_notes_actions (note_id);

-- Every transcription and AI job: who, how many minutes, which service, roughly what it cost.
create table if not exists public.arise_notes_usage (
  id bigserial primary key,
  user_id integer not null,
  pool_id integer not null,
  note_id uuid,
  kind text not null,
  minutes integer not null default 0,
  secs double precision not null default 0,
  provider text not null default '',
  cost_cents numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists arise_notes_usage_user_idx on public.arise_notes_usage (user_id, created_at desc);
create index if not exists arise_notes_usage_time_idx on public.arise_notes_usage (created_at desc);

-- Family plan: up to three people share the owner's minutes.
create table if not exists public.arise_notes_family (
  member_id integer primary key,
  owner_id integer not null,
  joined_at timestamptz not null default now()
);
create index if not exists arise_notes_family_owner_idx on public.arise_notes_family (owner_id);

alter table public.arise_notes_accounts enable row level security;
alter table public.arise_notes enable row level security;
alter table public.arise_notes_pieces enable row level security;
alter table public.arise_notes_segments enable row level security;
alter table public.arise_notes_actions enable row level security;
alter table public.arise_notes_usage enable row level security;
alter table public.arise_notes_family enable row level security;

-- Charges a transcribed piece in one step, so pieces written down at the same time can't miss
-- each other's minutes. Minutes are rounded up per recording (the note), not per piece.
create or replace function public.arise_notes_charge(p_note uuid, p_user integer, p_pool integer, p_secs double precision)
returns table (delta integer, pool_used integer, own_used integer, note_secs double precision, note_minutes integer)
language plpgsql security definer set search_path = public as $$
declare
  v_secs double precision;
  v_min integer;
  v_new_secs double precision;
  v_new_min integer;
  v_delta integer;
begin
  select n.charged_secs, n.charged_minutes into v_secs, v_min from public.arise_notes n where n.id = p_note for update;
  if not found then raise exception 'note not found'; end if;
  v_new_secs := v_secs + greatest(coalesce(p_secs, 0), 0);
  v_new_min := case when v_new_secs > 0 then ceil(round((v_new_secs * 100)::numeric) / 6000.0)::integer else 0 end;
  v_new_min := greatest(v_new_min, v_min);
  v_delta := v_new_min - v_min;
  update public.arise_notes set charged_secs = v_new_secs, charged_minutes = v_new_min, updated_at = now() where id = p_note;
  insert into public.arise_notes_accounts (user_id) values (p_pool) on conflict (user_id) do nothing;
  insert into public.arise_notes_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.arise_notes_accounts a set used = a.used + v_delta, updated_at = now() where a.user_id = p_pool;
  update public.arise_notes_accounts a set own = a.own + v_delta, updated_at = now() where a.user_id = p_user;
  return query select v_delta,
    (select a.used from public.arise_notes_accounts a where a.user_id = p_pool),
    (select a.own from public.arise_notes_accounts a where a.user_id = p_user),
    v_new_secs, v_new_min;
end $$;

-- Ask your notes: the lines of this person's notes that match any of the words, best first.
create or replace function public.arise_notes_search(p_owner integer, p_query text, p_from date, p_to date, p_limit integer)
returns table (note_id uuid, idx integer, start_s double precision, end_s double precision, speaker text, text text, title text, created_at timestamptz, rank real)
language sql stable security definer set search_path = public as $$
  select s.note_id, s.idx, s.start_s, s.end_s, s.speaker, s.text, n.title, n.created_at, ts_rank_cd(s.tsv, q) as rank
  from public.arise_notes_segments s
  join public.arise_notes n on n.id = s.note_id,
  websearch_to_tsquery('english', coalesce(p_query, '')) q
  where s.owner_id = p_owner and s.tsv @@ q
    and (p_from is null or n.created_at >= p_from)
    and (p_to is null or n.created_at < p_to + 1)
  order by rank desc, n.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 80);
$$;

-- The notes list's search box: titles and transcripts.
create or replace function public.arise_notes_find(p_owner integer, p_query text, p_limit integer)
returns table (id uuid, rank real)
language sql stable security definer set search_path = public as $$
  select n.id, ts_rank_cd(n.tsv, q) as rank
  from public.arise_notes n, websearch_to_tsquery('english', coalesce(p_query, '')) q
  where n.owner_id = p_owner and (n.tsv @@ q or n.title ilike '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by rank desc, n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.arise_notes_charge(uuid, integer, integer, double precision) from public, anon, authenticated;
revoke all on function public.arise_notes_search(integer, text, date, date, integer) from public, anon, authenticated;
revoke all on function public.arise_notes_find(integer, text, integer) from public, anon, authenticated;
grant execute on function public.arise_notes_charge(uuid, integer, integer, double precision) to service_role;
grant execute on function public.arise_notes_search(integer, text, date, date, integer) to service_role;
grant execute on function public.arise_notes_find(integer, text, integer) to service_role;

-- The audio, while it is kept (deleted after writing down unless the person chose to keep it).
insert into storage.buckets (id, name, public, file_size_limit)
values ('arise-notes-audio', 'arise-notes-audio', false, 26214400)
on conflict (id) do nothing;
