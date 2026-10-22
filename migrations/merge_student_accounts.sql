-- Merging a student's two accounts (server/accountMerge.ts): every merge is recorded here, with what
-- moved and what stayed on the archived duplicate. The merge itself runs in the server. Safe to run twice.
create table if not exists public.account_merges (
  id bigserial primary key,
  keep_id integer not null,
  dup_id integer not null,
  by_id integer,
  login text not null default 'keep',
  moved jsonb not null default '{}'::jsonb,
  skipped jsonb not null default '{}'::jsonb,
  points numeric not null default 0,
  at timestamptz not null default now()
);
create index if not exists account_merges_keep_idx on public.account_merges(keep_id);
alter table public.account_merges enable row level security;
revoke all on table public.account_merges from anon, authenticated;
grant select, insert, update, delete on table public.account_merges to service_role;
grant usage, select on sequence public.account_merges_id_seq to service_role;
