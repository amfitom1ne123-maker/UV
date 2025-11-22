create table if not exists public.users (
  tg_id      bigint primary key,
  username   text,
  name       text,
  email      text,
  phone      text,
  language   text,
  unit       text, -- убери, если не нужно
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_username on public.users (username);
