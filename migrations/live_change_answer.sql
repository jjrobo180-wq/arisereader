-- Live games: a player can change their answer while the question is still open. Picking a new
-- choice replaces the old one: the old points come off the player's score and the new answer is
-- scored at the moment it was changed (so the speed bonus counts from the final pick). Picking the
-- same choice again changes nothing. Once the teacher reveals or time runs out, answers are final.
create or replace function public.live_submit_answer(p_session uuid,p_user integer,p_index integer,p_choice text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.live_sessions%rowtype; q jsonb; is_right boolean; earned integer; remaining numeric;
  prev public.live_answers%rowtype; had_prev boolean;
begin
  select * into s from public.live_sessions where id=p_session for update;
  if not found or s.status<>'question' or s.current_question<>p_index or clock_timestamp()>s.question_deadline then
    raise exception 'This question is closed';
  end if;
  if p_choice not in ('A','B','C','D') then raise exception 'Invalid answer'; end if;
  if not exists(select 1 from public.live_players where session_id=p_session and user_id=p_user) then
    raise exception 'Join the game first';
  end if;

  select * into prev from public.live_answers
    where session_id=p_session and user_id=p_user and question_index=p_index;
  had_prev := found;
  if had_prev and prev.choice=p_choice then
    return jsonb_build_object('accepted',true,'choice',p_choice,'changed',false);
  end if;

  select questions->p_index into q from public.live_quizzes where id=s.quiz_id;
  is_right := p_choice=(q->>'correct');
  remaining := greatest(0,extract(epoch from (s.question_deadline-clock_timestamp())));
  earned := case when is_right then 500+floor(500*least(30,remaining)/30)::integer else 0 end;

  if had_prev then
    update public.live_answers set choice=p_choice,correct=is_right,points=earned,answered_at=clock_timestamp()
      where session_id=p_session and user_id=p_user and question_index=p_index;
    update public.live_players set score=score-prev.points+earned where session_id=p_session and user_id=p_user;
  else
    insert into public.live_answers(session_id,user_id,question_index,choice,correct,points)
      values(p_session,p_user,p_index,p_choice,is_right,earned);
    update public.live_players set score=score+earned where session_id=p_session and user_id=p_user;
  end if;
  return jsonb_build_object('accepted',true,'choice',p_choice,'changed',had_prev);
end;
$$;

revoke all on function public.live_submit_answer(uuid,integer,integer,text) from public, anon, authenticated;
grant execute on function public.live_submit_answer(uuid,integer,integer,text) to service_role;
