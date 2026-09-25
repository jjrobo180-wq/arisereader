-- Run once in the Supabase SQL Editor before deploying parent codes.
-- Only the server's service credential may read or create these codes.
create table if not exists public.parent_invite_codes (
  student_id bigint primary key references public.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint parent_invite_code_format check (code ~ '^[A-F0-9]{20}$')
);

alter table public.parent_invite_codes enable row level security;
revoke all on public.parent_invite_codes from anon, authenticated;
