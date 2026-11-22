-- Stage B eval (plan.md Phase 7: /admin/eval). Run once in Supabase: SQL Editor > New query > paste > Run.
-- eval_set holds YOUR OWN hand-labelled mail (cleaned text + expected items) for regression-testing prompts.
-- It is developer data, never filled for other users, and can be wiped at any time (delete from eval_set).

create table public.eval_set (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  msg_id text not null,
  direction text check (direction in ('sent', 'inbox')),
  sent_iso text,
  from_addr text,
  to_addr text,
  subject text,
  cleaned_text text,
  expected_json text,
  tags text,
  unique (user_id, msg_id)
);

-- Model answers cached per prompt version + model, so a partial run can resume (like Stage A's CacheService).
create table public.eval_cache (
  user_id uuid not null references public.users(id) on delete cascade,
  prompt_version text not null,
  model text not null,
  msg_id text not null,
  raw jsonb not null,
  primary key (user_id, prompt_version, model, msg_id)
);

alter table public.eval_set enable row level security;
alter table public.eval_cache enable row level security;
create policy eval_set_own on public.eval_set for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy eval_cache_own on public.eval_cache for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
