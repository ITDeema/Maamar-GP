-- =====================================================================================
-- Maamar database: tables, row level security (RLS), the create_analysis function.
-- Run the whole file once in Supabase -> SQL Editor. It can be run again safely.
--
-- Checked against the real database: Plot, Analysis, Project, their foreign keys.
-- Written from the ER diagram (compare them with the real tables, see the end of the chat message):
--   Site_Indicator, Design_Decision, Constraint, Decision_Factor, and the profiles / sign-up
--   trigger part (section 1).
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- 1. Profiles: the user's role and language. One row per account, created at sign-up.
--    (Email and password live in Supabase Auth.)
-- -------------------------------------------------------------------------------------

create table if not exists public.profiles (
  "userID"            uuid primary key references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  role                text not null check (role in ('homeowner', 'architect')),
  "preferredLanguage" text not null default 'ar' check ("preferredLanguage" in ('ar', 'en'))
);

-- The sign-up page sends the role as user metadata; this creates the profile from it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles ("userID", role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'role', 'homeowner'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -------------------------------------------------------------------------------------
-- 2. Plot, Analysis, Project
--    Project = what the user sees in History and Favorites. Analysis = one analysis of a plot.
-- -------------------------------------------------------------------------------------

create table if not exists public."Plot" (
  "plotID"           uuid primary key default gen_random_uuid(),
  "boundaryGeometry" jsonb,
  area               numeric not null,
  zoning             text,
  neighbourhood      text,
  orientation        text
);

create table if not exists public."Analysis" (
  "analysisID"             uuid primary key default gen_random_uuid(),
  "plotID"                 uuid not null references public."Plot" ("plotID") on delete cascade,
  "villaType"              text not null,
  "landArea"               double precision not null,
  "expectedBuildingHeight" double precision,
  status                   text not null default 'completed',
  "analysisDate"           timestamptz not null default now(),
  version                  text not null default 'v1'
);

create table if not exists public."Project" (
  "projectID"      uuid primary key default gen_random_uuid(),
  "userID"         uuid not null references auth.users (id) on delete cascade,
  "analysisID"     uuid not null references public."Analysis" ("analysisID") on delete cascade,
  "projectName"    text not null,
  "isFavorited"    boolean not null default false,
  "projectDate"    timestamptz not null default now(),
  "lastOpenedAt"   timestamptz,
  lat              double precision not null,
  lng              double precision not null,
  -- the user's role when the analysis was made (the dashboard suggests a new analysis when it changes)
  "roleAtAnalysis" text not null
);


-- -------------------------------------------------------------------------------------
-- 3. Results of an analysis. The backend fills these (with the service key), not the browser.
-- -------------------------------------------------------------------------------------

create table if not exists public."Site_Indicator" (
  "indicatorID"   uuid primary key default gen_random_uuid(),
  "analysisID"    uuid not null references public."Analysis" ("analysisID") on update cascade on delete cascade,
  "indicatorName" text not null,
  facade          text,
  value           double precision,
  unit            text
);

create table if not exists public."Design_Decision" (
  "designDecisionID" uuid primary key default gen_random_uuid(),
  "analysisID"       uuid not null references public."Analysis" ("analysisID") on update cascade on delete cascade,
  "decisionCategory" text not null,
  "finalDecision"    text not null,
  justification      text not null
);

create table if not exists public."Constraint" (
  "constraintID"   uuid primary key default gen_random_uuid(),
  "analysisID"     uuid not null references public."Analysis" ("analysisID") on update cascade on delete cascade,
  "constraintType" text not null,
  value            double precision not null
);

create table if not exists public."Decision_Factor" (
  "designDecisionID" uuid not null references public."Design_Decision" ("designDecisionID") on update cascade on delete cascade,
  "indicatorID"      uuid not null references public."Site_Indicator" ("indicatorID") on update cascade on delete cascade,
  "shapValue"        double precision not null,
  rank               integer not null,
  primary key ("designDecisionID", "indicatorID")
);

create index if not exists "Project_user_idx"             on public."Project" ("userID", "projectDate" desc);
create index if not exists "Project_analysis_idx"         on public."Project" ("analysisID");
create index if not exists "Analysis_plot_idx"            on public."Analysis" ("plotID");
create index if not exists "Site_Indicator_analysis_idx"  on public."Site_Indicator" ("analysisID");
create index if not exists "Design_Decision_analysis_idx" on public."Design_Decision" ("analysisID");
create index if not exists "Constraint_analysis_idx"      on public."Constraint" ("analysisID");
create index if not exists "Decision_Factor_indicator_idx" on public."Decision_Factor" ("indicatorID");


-- -------------------------------------------------------------------------------------
-- 4. Row level security
--    A user only sees their own profile, their own projects, and the analyses and plots of
--    those projects. The four result tables have no policy on purpose: the website does not
--    read them yet, and only the backend (service key) can.
-- -------------------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public."Plot"            enable row level security;
alter table public."Analysis"        enable row level security;
alter table public."Project"         enable row level security;
alter table public."Site_Indicator"  enable row level security;
alter table public."Design_Decision" enable row level security;
alter table public."Constraint"      enable row level security;
alter table public."Decision_Factor" enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = "userID");

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = "userID") with check ((select auth.uid()) = "userID");

drop policy if exists "Users can view their own projects" on public."Project";
create policy "Users can view their own projects" on public."Project"
  for select to authenticated using ((select auth.uid()) = "userID");

drop policy if exists "Users can update their own projects" on public."Project";
create policy "Users can update their own projects" on public."Project"
  for update to authenticated
  using ((select auth.uid()) = "userID") with check ((select auth.uid()) = "userID");

drop policy if exists "Users can view their analyses" on public."Analysis";
create policy "Users can view their analyses" on public."Analysis"
  for select to authenticated
  using (exists (select 1 from public."Project" p
                 where p."analysisID" = "Analysis"."analysisID"
                   and p."userID" = (select auth.uid())));

drop policy if exists "Users can view their plots" on public."Plot";
create policy "Users can view their plots" on public."Plot"
  for select to authenticated
  using (exists (select 1 from public."Analysis" a
                 join public."Project" p on p."analysisID" = a."analysisID"
                 where a."plotID" = "Plot"."plotID"
                   and p."userID" = (select auth.uid())));


-- -------------------------------------------------------------------------------------
-- 5. New analysis. Creates the plot, the analysis and the project together and returns the
--    project id. The role comes from profiles, so it cannot be faked from the browser.
-- -------------------------------------------------------------------------------------

create or replace function public.create_analysis(
  p_lat        double precision,
  p_lng        double precision,
  p_area       double precision,
  p_villa_type text,
  p_name       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_role     text;
  v_plot     uuid;
  v_analysis uuid;
  v_project  uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where "userID" = v_user;
  if v_role is null then
    raise exception 'Profile not found';
  end if;

  insert into public."Plot" (area)
    values (p_area)
    returning "plotID" into v_plot;

  insert into public."Analysis" ("plotID", "villaType", "landArea")
    values (v_plot, p_villa_type, p_area)
    returning "analysisID" into v_analysis;

  insert into public."Project" ("userID", "analysisID", "projectName", lat, lng, "roleAtAnalysis")
    values (v_user, v_analysis, btrim(p_name), p_lat, p_lng, v_role)
    returning "projectID" into v_project;

  return v_project;
end;
$$;

revoke all on function public.create_analysis(double precision, double precision, double precision, text, text)
  from public, anon;
grant execute on function public.create_analysis(double precision, double precision, double precision, text, text)
  to authenticated;


-- -------------------------------------------------------------------------------------
-- 6. Optional: value checks, and limiting what a user can change in a project.
--    Run this on every database that should behave the same. If a check fails because of old
--    test rows, delete them first (delete from public."Plot"; removes the test analyses too).
-- -------------------------------------------------------------------------------------

alter table public."Plot"
  drop constraint if exists "Plot_area_check",
  add constraint "Plot_area_check" check (area > 0);

alter table public."Analysis"
  drop constraint if exists "Analysis_villaType_check",
  drop constraint if exists "Analysis_landArea_check",
  drop constraint if exists "Analysis_expectedBuildingHeight_check",
  drop constraint if exists "Analysis_status_check",
  add constraint "Analysis_villaType_check" check ("villaType" in ('attachedBoth', 'attachedOne', 'detached')),
  add constraint "Analysis_landArea_check" check ("landArea" > 0),
  add constraint "Analysis_expectedBuildingHeight_check" check ("expectedBuildingHeight" > 0),
  add constraint "Analysis_status_check" check (status in ('running', 'completed', 'failed'));

alter table public."Project"
  drop constraint if exists "Project_projectName_check",
  drop constraint if exists "Project_lat_check",
  drop constraint if exists "Project_lng_check",
  drop constraint if exists "Project_roleAtAnalysis_check",
  add constraint "Project_projectName_check" check (btrim("projectName") <> '' and char_length("projectName") <= 60),
  add constraint "Project_lat_check" check (lat between -90 and 90),
  add constraint "Project_lng_check" check (lng between -180 and 180),
  add constraint "Project_roleAtAnalysis_check" check ("roleAtAnalysis" in ('homeowner', 'architect'));

-- A user may change only the name, the favorite and the opened time of a project.
revoke update on public."Project" from authenticated;
grant update ("projectName", "isFavorited", "lastOpenedAt", "roleAtAnalysis") on public."Project" to authenticated;
