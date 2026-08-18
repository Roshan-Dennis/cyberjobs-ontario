-- =====================================================================
-- CyberJobs Ontario — Supabase / Postgres schema
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- before pointing the app at your project.
-- =====================================================================

create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- jobs
--
-- The normalised job document is stored in `payload` (jsonb) so the
-- application schema can evolve without a migration, while the columns
-- that drive filtering and sorting are promoted for indexing.
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id             text primary key,
  fingerprint    text not null,
  payload        jsonb not null,

  posted_at      timestamptz,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  is_expired     boolean not null default false,
  rank_score     integer not null default 0,

  -- Generated columns kept in sync with the payload for cheap SQL access.
  title          text generated always as (payload ->> 'title') stored,
  company        text generated always as (payload ->> 'company') stored,
  company_slug   text generated always as (payload ->> 'companySlug') stored,
  city           text generated always as (payload ->> 'city') stored,
  region         text generated always as (payload ->> 'region') stored,
  category       text generated always as (payload ->> 'category') stored,
  experience     text generated always as (payload ->> 'experienceLevel') stored,
  arrangement    text generated always as (payload ->> 'workArrangement') stored,
  employment     text generated always as (payload ->> 'employmentType') stored,
  source_id      text generated always as (payload ->> 'sourceId') stored,
  is_pathway     boolean generated always as ((payload ->> 'isPathwayRole')::boolean) stored,
  relevance      integer generated always as ((payload ->> 'relevanceScore')::integer) stored,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists jobs_rank_idx        on public.jobs (rank_score desc);
create index if not exists jobs_posted_idx      on public.jobs (posted_at desc nulls last);
create index if not exists jobs_last_seen_idx   on public.jobs (last_seen_at desc);
create index if not exists jobs_expired_idx     on public.jobs (is_expired) where is_expired = false;
create index if not exists jobs_fingerprint_idx on public.jobs (fingerprint);
create index if not exists jobs_category_idx    on public.jobs (category);
create index if not exists jobs_experience_idx  on public.jobs (experience);
create index if not exists jobs_city_idx        on public.jobs (city);
create index if not exists jobs_company_idx     on public.jobs (company_slug);
create index if not exists jobs_source_idx      on public.jobs (source_id);
create index if not exists jobs_payload_gin     on public.jobs using gin (payload jsonb_path_ops);
create index if not exists jobs_title_trgm      on public.jobs using gin (title gin_trgm_ops);
create index if not exists jobs_company_trgm    on public.jobs using gin (company gin_trgm_ops);

-- Full-text search vector over the fields users actually search.
alter table public.jobs
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(payload ->> 'title', '')), 'A') ||
    setweight(to_tsvector('english', coalesce(payload ->> 'company', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(payload ->> 'city', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(payload ->> 'summary', '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(payload ->> 'description', ''), 40000)), 'D')
  ) stored;

create index if not exists jobs_search_idx on public.jobs using gin (search_tsv);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- ingest_meta — single row holding the last run's summary
-- ---------------------------------------------------------------------
create table if not exists public.ingest_meta (
  id             text primary key default 'singleton',
  last_ingest_at timestamptz,
  last_report    jsonb,
  job_count      integer not null default 0,
  updated_at     timestamptz not null default now()
);

insert into public.ingest_meta (id) values ('singleton')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- ingest_runs — append-only history, useful for spotting a source that
-- has quietly stopped returning results.
-- ---------------------------------------------------------------------
create table if not exists public.ingest_runs (
  id          bigserial primary key,
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  fetched     integer not null default 0,
  kept        integer not null default 0,
  inserted    integer not null default 0,
  updated     integer not null default 0,
  expired     integer not null default 0,
  report      jsonb
);

create index if not exists ingest_runs_started_idx on public.ingest_runs (started_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- The app reads through the service-role key on the server, so anon needs
-- read-only access at most. Writes are server-side only.
-- ---------------------------------------------------------------------
alter table public.jobs        enable row level security;
alter table public.ingest_meta enable row level security;
alter table public.ingest_runs enable row level security;

drop policy if exists "public read jobs" on public.jobs;
create policy "public read jobs"
  on public.jobs for select
  to anon, authenticated
  using (true);

drop policy if exists "public read meta" on public.ingest_meta;
create policy "public read meta"
  on public.ingest_meta for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: only the service-role key (which
-- bypasses RLS) may write.

-- ---------------------------------------------------------------------
-- Convenience view: everything currently open.
-- ---------------------------------------------------------------------
create or replace view public.jobs_open as
  select * from public.jobs where is_expired = false;

-- ---------------------------------------------------------------------
-- Retention: drop postings not seen for 120 days.
-- Schedule with pg_cron if available:
--   select cron.schedule('purge-jobs', '0 4 * * *', $$select public.purge_old_jobs(120)$$);
-- ---------------------------------------------------------------------
create or replace function public.purge_old_jobs(days integer default 120)
returns integer
language plpgsql
security definer
as $$
declare
  removed integer;
begin
  delete from public.jobs
   where last_seen_at < now() - (days || ' days')::interval;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
