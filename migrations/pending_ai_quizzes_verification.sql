-- How each AI quiz request's book was checked ("Did you mean", sources), shown on the approval screen.
-- Shape: shared/bookMatch.ts QuizVerification.
alter table public.pending_ai_quizzes add column if not exists verification jsonb;
