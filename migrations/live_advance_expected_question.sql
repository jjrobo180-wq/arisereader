-- Live games: "reveal" and "next" only act on the question the teacher's screen was showing
-- (p_question). Before this, a reveal sent a moment late could land on the next question and the
-- teacher's next click moved on again, so a question looked skipped. p_question is optional so older
-- callers keep working.
drop function if exists public.live_advance_action(uuid, integer, text);

create or replace function public.live_advance_action(p_session uuid, p_teacher integer, p_action text, p_question integer default null)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  s public.live_sessions%rowtype;
  q_count integer;
  changed boolean := false;
begin
  if p_action not in ('start','reveal','next') then
    raise exception 'Invalid live quiz action';
  end if;

  select * into s from public.live_sessions where id = p_session for update;

  if not found or s.teacher_id <> p_teacher then
    raise exception 'Session not found';
  end if;

  -- A click meant for another question does nothing.
  if p_action in ('reveal','next') and p_question is not null and s.current_question <> p_question then
    return jsonb_build_object('status', s.status, 'currentQuestion', s.current_question, 'changed', false);
  end if;

  if p_action = 'reveal' then
    if s.status = 'question' then
      update public.live_sessions set status = 'results', question_deadline = null
      where id = p_session returning * into s;
      changed := true;
    end if;

  elsif p_action = 'start' then
    if s.status = 'lobby' then
      select jsonb_array_length(questions) into q_count from public.live_quizzes where id = s.quiz_id;
      if q_count < 1 then
        raise exception 'Quiz has no questions';
      end if;
      update public.live_sessions
      set status = 'question', current_question = 0,
          question_started_at = clock_timestamp(),
          question_deadline = clock_timestamp() + interval '30 seconds'
      where id = p_session returning * into s;
      changed := true;
    end if;

  elsif p_action = 'next' then
    if s.status = 'results' then
      select jsonb_array_length(questions) into q_count from public.live_quizzes where id = s.quiz_id;
      if s.current_question + 1 >= q_count then
        update public.live_sessions set status = 'finished', question_deadline = null
        where id = p_session returning * into s;
      else
        update public.live_sessions
        set status = 'question', current_question = s.current_question + 1,
            question_started_at = clock_timestamp(),
            question_deadline = clock_timestamp() + interval '30 seconds'
        where id = p_session returning * into s;
      end if;
      changed := true;
    end if;
  end if;

  return jsonb_build_object('status', s.status, 'currentQuestion', s.current_question, 'changed', changed);
end;
$function$;

revoke all on function public.live_advance_action(uuid,integer,text,integer) from public, anon, authenticated;
grant execute on function public.live_advance_action(uuid,integer,text,integer) to service_role;
