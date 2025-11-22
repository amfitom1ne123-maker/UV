create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'req_status') then
    create type req_status as enum ('pending','confirmed','done','cancelled','cancelled_by_user');
  end if;
end$$;

create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    bigint not null references public.users(tg_id) on delete cascade,
  category   text not null,
  unit       text,
  details    text,
  status     req_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requests_user_created on public.requests (user_id, created_at desc);

-- trigger for updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_requests_set_updated_at on public.requests;
create trigger trg_requests_set_updated_at
before update on public.requests
for each row execute function public.set_updated_at();
