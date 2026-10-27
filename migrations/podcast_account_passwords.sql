-- Pod+ accounts can have a password (scrypt hash) besides email codes. Applied 2026-10-27.
alter table public.podcast_accounts add column if not exists password_hash text;
