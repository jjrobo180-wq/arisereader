-- Smart ad skip for Earshot (LifeHub) and Podscroll: what listeners share with each other.
--  podcast_ad_marks: "Mark ad" ranges, in the marker's copy of the episode (dur = that copy's length,
--                    since podcasts often stitch different ads into each download).
--  podcast_ad_votes: one vote per listener per ad (-1 "not an ad", +1 "yes, an ad"); ad_key names
--                    an automatic find (a:), a listener mark group (u:) or a skip spot (c:).
--  podcast_ad_skips: forward jumps; spots several listeners skip become "Listeners skip this".
-- Voters are "u<Arise user id>" or "d<Podscroll device id>". Only the server's service role may use these.
create table if not exists public.podcast_ad_marks (
  id bigserial primary key,
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  show_id text not null default '' check (show_id ~ '^[0-9]{0,20}$'),
  s real not null check (s >= 0),
  e real not null,
  dur real not null check (dur > 0 and dur < 86400),
  label text check (label is null or char_length(label) <= 60),
  voter text not null check (char_length(voter) between 2 and 60),
  created_at timestamptz not null default now(),
  constraint podcast_ad_marks_range check (e > s and e - s between 3 and 900)
);
create index if not exists podcast_ad_marks_episode on public.podcast_ad_marks (episode_id);

create table if not exists public.podcast_ad_votes (
  ad_key text not null check (char_length(ad_key) between 3 and 120),
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  voter text not null check (char_length(voter) between 2 and 60),
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (ad_key, voter)
);
create index if not exists podcast_ad_votes_episode on public.podcast_ad_votes (episode_id);

create table if not exists public.podcast_ad_skips (
  id bigserial primary key,
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  from_s real not null check (from_s >= 0),
  to_s real not null,
  dur real not null check (dur > 0 and dur < 86400),
  voter text not null check (char_length(voter) between 2 and 60),
  created_at timestamptz not null default now(),
  constraint podcast_ad_skips_range check (to_s - from_s between 10 and 300)
);
create index if not exists podcast_ad_skips_episode on public.podcast_ad_skips (episode_id, created_at desc);

alter table public.podcast_ad_marks enable row level security;
alter table public.podcast_ad_votes enable row level security;
alter table public.podcast_ad_skips enable row level security;
revoke all on public.podcast_ad_marks, public.podcast_ad_votes, public.podcast_ad_skips from anon, authenticated;
grant select, insert, update, delete on public.podcast_ad_marks, public.podcast_ad_votes, public.podcast_ad_skips to service_role;
grant usage, select on sequence public.podcast_ad_marks_id_seq, public.podcast_ad_skips_id_seq to service_role;
drop policy if exists "server manages ad marks" on public.podcast_ad_marks;
create policy "server manages ad marks" on public.podcast_ad_marks for all to service_role using (true) with check (true);
drop policy if exists "server manages ad votes" on public.podcast_ad_votes;
create policy "server manages ad votes" on public.podcast_ad_votes for all to service_role using (true) with check (true);
drop policy if exists "server manages ad skips" on public.podcast_ad_skips;
create policy "server manages ad skips" on public.podcast_ad_skips for all to service_role using (true) with check (true);
