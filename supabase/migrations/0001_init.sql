-- Promise Keeper Stage B schema (plan.md Phase 7). Mirrors the Stage A Sheet tabs.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Row-level security: every table with user data is keyed by user_id. The web app queries with a short-lived
-- JWT whose `sub` is users.id (so auth.uid() = users.id). oauth_tokens has NO policy, so tokens are never
-- readable with a user JWT; only the server's service-role key can touch them.
-- Email bodies are never stored: only extracted fields and the evidence sentence.

create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  name text,
  timezone text not null default 'Asia/Kolkata',
  digest_hour int not null default 8 check (digest_hour between 0 and 23),
  auto_add_enabled boolean not null default false,
  auto_add_threshold numeric not null default 0.9,
  share_metrics boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Refresh token encrypted with AES-256-GCM in the app (TOKEN_ENC_KEY). Never stored in plain text.
create table public.oauth_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  refresh_token_enc text not null,
  scopes text not null default '',
  gmail_history_id text,
  watch_expiration timestamptz,
  tasklist_id text,
  updated_at timestamptz not null default now()
);

create table public.processed_messages (
  user_id uuid not null references public.users(id) on delete cascade,
  msg_id text not null,
  thread_id text not null,
  direction text check (direction in ('sent', 'inbox')),
  internal_date bigint,
  processed_at timestamptz not null default now(),
  item_count int not null default 0,
  prompt_version text,
  error text,
  primary key (user_id, msg_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  msg_id text not null,
  thread_id text not null,
  direction text not null check (direction in ('sent', 'inbox')),
  type text not null check (type in ('my_promise', 'request_to_me', 'deadline', 'waiting_on')),
  what text not null,
  counterparty_name text not null default '',
  counterparty_email text not null default '',
  due date,
  due_text text not null default '',
  needs_date boolean not null default false,
  confidence numeric not null default 0,
  evidence text not null,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dismissed', 'done', 'possibly_resolved')),
  task_id text,
  event_id text,
  fingerprint text not null,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, fingerprint)
);
create index items_user_thread on public.items (user_id, thread_id);
create index items_user_status_due on public.items (user_id, status, due);

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  ts timestamptz not null default now(),
  item_id uuid,
  action text not null check (action in ('accept', 'edit', 'dismiss', 'done', 'nudge')),
  before_json jsonb not null default '{}',
  after_json jsonb not null default '{}'
);
create index feedback_user_ts on public.feedback (user_id, ts);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  ts timestamptz not null default now(),
  event text not null,   -- digest_sent | digest_open | digest_click | sidebar_open | scan | ...
  meta jsonb not null default '{}'
);
create index events_user_ts on public.events (user_id, ts);

create table public.settings (
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (user_id, key)
);

create table public.eval_runs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  ts timestamptz not null default now(),
  prompt_version text not null,
  model text,
  rows int,
  shown_precision numeric,
  shown_recall numeric,
  overall_precision numeric,
  overall_recall numeric,
  date_accuracy numeric,
  needs_date_accuracy numeric,
  gate boolean,
  per_type jsonb,
  sweep jsonb
);

-- New message ids from Gmail push notifications, waiting to be processed in small batches.
create table public.message_queue (
  user_id uuid not null references public.users(id) on delete cascade,
  msg_id text not null,
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  primary key (user_id, msg_id)
);

-- Deletions are logged without personal data (hashed id only).
create table public.deletion_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  user_hash text not null,
  rows_deleted jsonb not null default '{}'
);

-- ---------- row-level security ----------
alter table public.users enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.processed_messages enable row level security;
alter table public.items enable row level security;
alter table public.feedback enable row level security;
alter table public.events enable row level security;
alter table public.settings enable row level security;
alter table public.eval_runs enable row level security;
alter table public.message_queue enable row level security;
alter table public.deletion_log enable row level security;

create policy users_self on public.users for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy processed_own on public.processed_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy items_own on public.items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy feedback_own on public.feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_own on public.events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy settings_own on public.settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy eval_runs_own on public.eval_runs for select to authenticated using (user_id = auth.uid());
create policy queue_own on public.message_queue for select to authenticated using (user_id = auth.uid());
-- oauth_tokens and deletion_log: no policies on purpose (service role only).
