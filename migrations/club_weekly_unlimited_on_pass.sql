alter table if exists public.club_arise_controls
add column if not exists weekly_unlimited_on_pass boolean not null default true;
