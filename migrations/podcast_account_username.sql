-- Pod+ accounts can have a username as well as an email (sign in with either).
alter table public.podcast_accounts add column if not exists username text;
create unique index if not exists podcast_accounts_username_lower on public.podcast_accounts (lower(username)) where username is not null;
