-- Live classroom quizzes. The app authenticates users with its own sessions;
-- only the server's service-role client may access these tables and functions.
create table if not exists public.live_quizzes (
  id bigint generated always as identity primary key,
  teacher_id integer not null references public.users(id),
  title text not null check (char_length(title) between 3 and 100),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  code varchar(6) not null unique check (code ~ '^[A-Z2-9]{6}$'),
  quiz_id bigint not null references public.live_quizzes(id),
  teacher_id integer not null references public.users(id),
  status text not null default 'lobby' check (status in ('lobby','question','results','finished')),
  current_question integer not null default -1,
  question_started_at timestamptz,
  question_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_players (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id integer not null references public.users(id),
  display_name text not null,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (session_id,user_id)
);

create table if not exists public.live_answers (
  session_id uuid not null,
  user_id integer not null,
  question_index integer not null,
  choice char(1) not null check (choice in ('A','B','C','D')),
  correct boolean not null,
  points integer not null,
  answered_at timestamptz not null default now(),
  primary key (session_id,user_id,question_index),
  foreign key (session_id,user_id) references public.live_players(session_id,user_id) on delete cascade
);

create index if not exists live_sessions_teacher_date on public.live_sessions(teacher_id,created_at desc);
create index if not exists live_answers_question on public.live_answers(session_id,question_index);

alter table public.live_quizzes enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_players enable row level security;
alter table public.live_answers enable row level security;
revoke all on public.live_quizzes, public.live_sessions, public.live_players, public.live_answers from anon, authenticated;
grant all on public.live_quizzes, public.live_sessions, public.live_players, public.live_answers to service_role;
grant usage, select on sequence public.live_quizzes_id_seq to service_role;

-- Both transitions and answers lock the same session row, preventing an answer
-- from slipping into a question after the teacher has revealed its result.
create or replace function public.live_advance(p_session uuid, p_teacher integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.live_sessions%rowtype; q_count integer;
begin
  select * into s from public.live_sessions where id=p_session for update;
  if not found or s.teacher_id<>p_teacher then raise exception 'Session not found'; end if;
  if s.status='question' then
    update public.live_sessions set status='results',question_deadline=null where id=p_session returning * into s;
  elsif s.status in ('lobby','results') then
    select jsonb_array_length(questions) into q_count from public.live_quizzes where id=s.quiz_id;
    if s.current_question+1>=q_count then
      update public.live_sessions set status='finished',question_deadline=null where id=p_session returning * into s;
    else
      update public.live_sessions set status='question',current_question=s.current_question+1,
        question_started_at=clock_timestamp(),question_deadline=clock_timestamp()+interval '30 seconds'
      where id=p_session returning * into s;
    end if;
  end if;
  return jsonb_build_object('status',s.status,'currentQuestion',s.current_question);
end;
$$;

create or replace function public.live_submit_answer(p_session uuid,p_user integer,p_index integer,p_choice text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.live_sessions%rowtype; q jsonb; is_right boolean; earned integer; remaining numeric;
begin
  select * into s from public.live_sessions where id=p_session for update;
  if not found or s.status<>'question' or s.current_question<>p_index or clock_timestamp()>s.question_deadline then
    raise exception 'This question is closed';
  end if;
  if p_choice not in ('A','B','C','D') then raise exception 'Invalid answer'; end if;
  if not exists(select 1 from public.live_players where session_id=p_session and user_id=p_user) then
    raise exception 'Join the game first';
  end if;
  if exists(select 1 from public.live_answers where session_id=p_session and user_id=p_user and question_index=p_index) then
    raise exception 'Answer already submitted';
  end if;
  select questions->p_index into q from public.live_quizzes where id=s.quiz_id;
  is_right := p_choice=(q->>'correct');
  remaining := greatest(0,extract(epoch from (s.question_deadline-clock_timestamp())));
  earned := case when is_right then 500+floor(500*least(30,remaining)/30)::integer else 0 end;
  insert into public.live_answers(session_id,user_id,question_index,choice,correct,points)
    values(p_session,p_user,p_index,p_choice,is_right,earned);
  update public.live_players set score=score+earned where session_id=p_session and user_id=p_user;
  return jsonb_build_object('accepted',true,'choice',p_choice);
end;
$$;

revoke all on function public.live_advance(uuid,integer), public.live_submit_answer(uuid,integer,integer,text) from public, anon, authenticated;
grant execute on function public.live_advance(uuid,integer), public.live_submit_answer(uuid,integer,integer,text) to service_role;
