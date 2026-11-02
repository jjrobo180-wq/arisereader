-- Arise Notes → Notes (shared/arisePages.ts, server/arisePages.ts): typed and handwritten notes,
-- synced across devices. Reached only through the server with the service role: row level security
-- is on with no policies. Each route checks the note belongs to the person asking.
-- A locked note's content is ciphertext made on the device (`cipher`); `content` is then empty.

create table if not exists public.arise_pages (
  id uuid primary key,
  owner_id integer not null,
  kind text not null default 'text',              -- text | ink
  folder_id uuid,
  color text not null default '',
  pinned boolean not null default false,
  tags text[] not null default '{}',
  locked boolean not null default false,
  content jsonb not null default '{}'::jsonb,     -- {title, html, ink, look}
  cipher jsonb,                                    -- {v, iv, data} when locked
  preview text not null default '',
  search text not null default '',
  bytes integer not null default 0,
  rev integer not null default 1,                  -- +1 on every save; a save names the rev it started from
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                           -- in Recently Deleted for 30 days
);
create index if not exists arise_pages_owner_idx on public.arise_pages (owner_id, updated_at desc);
alter table public.arise_pages enable row level security;

-- Folders, the notes password check (never the password) and view preferences, one row per person.
create table if not exists public.arise_pages_settings (
  owner_id integer primary key,
  data jsonb not null default '{}'::jsonb,
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.arise_pages_settings enable row level security;

-- Earlier versions of a note (at most one every 10 minutes, the last 30 kept).
create table if not exists public.arise_page_versions (
  page_id uuid not null references public.arise_pages(id) on delete cascade,
  rev integer not null,
  owner_id integer not null,
  kind text not null default 'text',
  locked boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  cipher jsonb,
  bytes integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (page_id, rev)
);
alter table public.arise_page_versions enable row level security;
