-- The data of the architect's analytical diagrams (land use and roads), saved per plot in "Plot_Surroundings".
-- The sun and wind diagram is not saved: it is the same for all of Riyadh.
-- Run it once in Supabase -> SQL Editor, AFTER analysis-reuse.sql. Safe to run twice; nothing is deleted.
--
-- The rule:
--   * Only for architects (the role of the project, Project.roleAtAnalysis). Homeowners never fetch or save it.
--   * A plot's surroundings fetched less than 6 months ago (by any architect) are reused, not fetched again.
--   * After 6 months a NEW row is added; the old rows stay, so old projects keep the diagrams of their time.
--   * A project older than 6 months shows the surroundings of its own time (fetched up to 6 months after its
--     analysis); when it has none, the newest ones. "Update this project" makes it new again, and then it
--     takes surroundings less than 6 months old (or fetches them).

-- 1. The table (Plot 1 —— 0..* Plot_Surroundings)
create table if not exists public."Plot_Surroundings" (
  "surroundingsID" uuid primary key default gen_random_uuid(),
  "plotID"         uuid not null references public."Plot" ("plotID") on delete cascade,
  "landUseData"    jsonb not null,
  "roadsData"      jsonb not null,
  "fetchedAt"      timestamptz not null default now()
);

alter table public."Plot_Surroundings" drop column if exists radius;
alter table public."Plot_Surroundings" drop column if exists source;

create index if not exists "Plot_Surroundings_plot_idx"
  on public."Plot_Surroundings" ("plotID", "fetchedAt" desc);

alter table public."Plot_Surroundings" enable row level security;

-- the user reads the surroundings of the plots in their own projects (writing is only through save_surroundings)
drop policy if exists "Users can view surroundings of their plots" on public."Plot_Surroundings";
create policy "Users can view surroundings of their plots" on public."Plot_Surroundings"
  for select to authenticated
  using (exists (
    select 1 from public."Analysis" a
    join public."Project" p on p."analysisID" = a."analysisID"
    where a."plotID" = "Plot_Surroundings"."plotID"
      and p."userID" = (select auth.uid())
  ));


-- 2. The surroundings a project shows. null = none saved (the website then fetches them and saves them),
--    or the project is not an architect's.
create or replace function public.project_surroundings(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plot uuid;
  v_date timestamptz;
  v_role text;
  v_row  public."Plot_Surroundings";
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select a."plotID", a."analysisDate", p."roleAtAnalysis" into v_plot, v_date, v_role
    from public."Project" p
    join public."Analysis" a on a."analysisID" = p."analysisID"
    where p."projectID" = p_project and p."userID" = v_user;
  if v_plot is null then
    raise exception 'Project not found';
  end if;
  if v_role is distinct from 'architect' then
    return null; -- the diagrams are for architects only
  end if;

  if v_date > now() - interval '6 months' then
    -- a recent analysis: surroundings less than 6 months old
    select * into v_row from public."Plot_Surroundings"
      where "plotID" = v_plot and "fetchedAt" > now() - interval '6 months'
      order by "fetchedAt" desc limit 1;
  else
    -- an analysis older than 6 months: the surroundings of its own time, otherwise the newest ones
    select * into v_row from public."Plot_Surroundings"
      where "plotID" = v_plot and "fetchedAt" <= v_date + interval '6 months'
      order by "fetchedAt" desc limit 1;
    if v_row."surroundingsID" is null then
      select * into v_row from public."Plot_Surroundings"
        where "plotID" = v_plot
        order by "fetchedAt" desc limit 1;
    end if;
  end if;

  if v_row."surroundingsID" is null then
    return null;
  end if;
  return jsonb_build_object(
    'landUseData', v_row."landUseData",
    'roadsData',   v_row."roadsData",
    'fetchedAt',   v_row."fetchedAt"
  );
end;
$$;

revoke all on function public.project_surroundings(uuid) from public, anon;
grant execute on function public.project_surroundings(uuid) to authenticated;


-- 3. Saves the surroundings the website fetched for a project (architects only).
--    Not saved again when the plot already has surroundings less than 6 months old (no duplicates).
create or replace function public.save_surroundings(
  p_project  uuid,
  p_land_use jsonb,
  p_roads    jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plot uuid;
  v_role text;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select a."plotID", p."roleAtAnalysis" into v_plot, v_role
    from public."Project" p
    join public."Analysis" a on a."analysisID" = p."analysisID"
    where p."projectID" = p_project and p."userID" = v_user;
  if v_plot is null then
    raise exception 'Project not found';
  end if;
  if v_role is distinct from 'architect' then
    raise exception 'The diagrams are for architects only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_land_use) is distinct from 'object' or jsonb_typeof(p_roads) is distinct from 'object' then
    raise exception 'p_land_use and p_roads must be JSON objects';
  end if;

  if exists (
    select 1 from public."Plot_Surroundings"
    where "plotID" = v_plot and "fetchedAt" > now() - interval '6 months'
  ) then
    return false; -- already saved (by this or another architect)
  end if;

  insert into public."Plot_Surroundings" ("plotID", "landUseData", "roadsData")
    values (v_plot, p_land_use, p_roads);
  return true;
end;
$$;

revoke all on function public.save_surroundings(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_surroundings(uuid, jsonb, jsonb) to authenticated;


-- 4. For the analysis page: does this plot have surroundings less than 6 months old?
--    Then it does not start fetching them. Only answers yes or no.
create or replace function public.has_recent_surroundings(p_boundary jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and p_boundary is not null and exists (
    select 1
    from public."Plot" pl
    join public."Plot_Surroundings" s on s."plotID" = pl."plotID"
    where pl."boundaryKey" = md5(p_boundary::text)
      and s."fetchedAt" > now() - interval '6 months'
  );
$$;

revoke all on function public.has_recent_surroundings(jsonb) from public, anon;
grant execute on function public.has_recent_surroundings(jsonb) to authenticated;
