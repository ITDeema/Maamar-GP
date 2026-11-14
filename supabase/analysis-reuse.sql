-- Reusing an analysis (for 6 months) and copy-on-write.
-- Run it once in Supabase -> SQL Editor, AFTER plot-per-parcel.sql. Safe to run twice; nothing is deleted.
--
-- The rule:
--   * The same plot + villa type + land area + expected height, analysed less than 6 months ago (by anyone),
--     is not calculated again: the new project points to that analysis and shows it straight away.
--     If the same user already has a project on it, that project is opened again (no second project).
--   * Anything different (one of the three inputs, or older than 6 months) gives a new analysis.
--   * "Update this project" on an analysis that other projects also use gives this project its own copy
--     (copy-on-write), so the other users' projects never change.


-- 1. create_analysis: the same inputs as before, now with the reuse.
create or replace function public.create_analysis(
  p_lat           double precision,
  p_lng           double precision,
  p_area          double precision,           -- the area the user entered
  p_villa_type    text,
  p_name          text,
  p_height        double precision default null,  -- the expected building height (null = not given)
  p_boundary      jsonb default null,             -- GeoJSON Polygon of the plot (required)
  p_plot_area     double precision default null,  -- the real area from the parcels layer
  p_zoning        text default null,              -- the plot's land use (ParcelSub)
  p_neighbourhood text default null,
  p_orientation   text default null               -- the main facade, e.g. "northEast"
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

  -- Only residential plots are analysed.
  if p_boundary is null then
    raise exception 'A residential plot is required' using errcode = '22023';
  end if;
  if p_zoning is not null and position('سكني' in p_zoning) = 0 then
    raise exception 'Only residential plots can be analysed' using errcode = '22023';
  end if;

  -- the same plot analysed before (by anyone) keeps its row; the first time, it is created
  insert into public."Plot" ("boundaryGeometry", area, zoning, neighbourhood, orientation)
    values (p_boundary, coalesce(p_plot_area, p_area), p_zoning, p_neighbourhood, p_orientation)
    on conflict ("boundaryKey") do nothing;
  select "plotID" into v_plot from public."Plot" where "boundaryKey" = md5(p_boundary::text);
  update public."Plot" set
    zoning        = coalesce(zoning, p_zoning),
    neighbourhood = coalesce(neighbourhood, p_neighbourhood),
    orientation   = coalesce(orientation, p_orientation)
  where "plotID" = v_plot;

  -- a finished analysis with the same three inputs, less than 6 months old
  v_analysis := public.reusable_analysis(v_plot, p_villa_type, p_area, p_height);

  if v_analysis is not null then
    -- the same user already has a project on it: open that project again
    select "projectID" into v_project
      from public."Project"
      where "userID" = v_user and "analysisID" = v_analysis
      order by "projectDate" desc
      limit 1;
    if v_project is not null then
      return v_project;
    end if;
  else
    insert into public."Analysis" ("plotID", "villaType", "landArea", "expectedBuildingHeight")
      values (v_plot, p_villa_type, p_area, p_height)
      returning "analysisID" into v_analysis;
  end if;

  insert into public."Project" ("userID", "analysisID", "projectName", lat, lng, "roleAtAnalysis")
    values (v_user, v_analysis, btrim(p_name), p_lat, p_lng, v_role)
    returning "projectID" into v_project;

  return v_project;
end;
$$;


-- 2. The reusable analysis of a plot: finished (its results are saved), the same villa type, area and
--    height (an empty height matches an empty height), and less than 6 months old. The newest one wins.
create or replace function public.reusable_analysis(
  p_plot       uuid,
  p_villa_type text,
  p_area       double precision,
  p_height     double precision
) returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a."analysisID"
    from public."Analysis" a
    where a."plotID" = p_plot
      and a."villaType" = p_villa_type
      and a."landArea" = p_area
      and a."expectedBuildingHeight" is not distinct from p_height
      and a.results is not null
      and a."analysisDate" > now() - interval '6 months'
    order by a."analysisDate" desc
    limit 1;
$$;

-- Used inside create_analysis only (the website calls has_reusable_analysis below).
revoke all on function public.reusable_analysis(uuid, text, double precision, double precision) from public, anon, authenticated;


-- 3. For the analysis page: is there an analysis to reuse? Then it does not calculate again.
--    Only answers yes or no (no data of other users is returned).
create or replace function public.has_reusable_analysis(
  p_boundary   jsonb,
  p_villa_type text,
  p_area       double precision,
  p_height     double precision default null
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plot uuid;
begin
  if auth.uid() is null or p_boundary is null then
    return false;
  end if;
  select "plotID" into v_plot from public."Plot" where "boundaryKey" = md5(p_boundary::text);
  if v_plot is null then
    return false;
  end if;
  return public.reusable_analysis(v_plot, p_villa_type, p_area, p_height) is not null;
end;
$$;

revoke all on function public.has_reusable_analysis(jsonb, text, double precision, double precision) from public, anon;
grant execute on function public.has_reusable_analysis(jsonb, text, double precision, double precision) to authenticated;


-- 4. Copy-on-write: before "Update this project" saves new results, the project gets its own analysis
--    when other projects use the same one. Returns the analysis this project may write to.
create or replace function public.own_analysis(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_analysis uuid;
  v_copy     uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select "analysisID" into v_analysis
    from public."Project"
    where "projectID" = p_project and "userID" = v_user;
  if v_analysis is null then
    raise exception 'Project not found';
  end if;

  -- only this project uses it: write to it directly
  if not exists (
    select 1 from public."Project"
    where "analysisID" = v_analysis and "projectID" <> p_project
  ) then
    return v_analysis;
  end if;

  -- shared: a new analysis with the same inputs (its results are saved right after)
  insert into public."Analysis" ("plotID", "villaType", "landArea", "expectedBuildingHeight", status, version)
    select "plotID", "villaType", "landArea", "expectedBuildingHeight", status, version
    from public."Analysis" where "analysisID" = v_analysis
    returning "analysisID" into v_copy;

  update public."Project" set "analysisID" = v_copy where "projectID" = p_project;
  return v_copy;
end;
$$;

revoke all on function public.own_analysis(uuid) from public, anon;
grant execute on function public.own_analysis(uuid) to authenticated;


-- 5. The nearest services, when they arrive after the analysis was saved (they load on their own).
--    Only fills them in when they are missing, so it never changes what another user already sees.
--    p_services goes into Analysis.results, p_rows into Site_Indicator (one row per service kind).
create or replace function public.add_services(
  p_project  uuid,
  p_services jsonb,
  p_rows     jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_analysis uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select "analysisID" into v_analysis
    from public."Project"
    where "projectID" = p_project and "userID" = v_user;
  if v_analysis is null then
    raise exception 'Project not found';
  end if;

  if jsonb_typeof(p_services) is distinct from 'array' or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_services and p_rows must be JSON arrays';
  end if;

  update public."Analysis"
    set results = jsonb_set(results, '{data,services}', p_services)
    where "analysisID" = v_analysis
      and results is not null
      and coalesce(jsonb_typeof(results #> '{data,services}'), 'null') = 'null';
  if not found then
    return false; -- already there (or no results yet)
  end if;

  delete from public."Site_Indicator"
    where "analysisID" = v_analysis and "indicatorName" in ('serviceDistance', 'serviceCount');
  insert into public."Site_Indicator" ("analysisID", "indicatorName", facade, value, unit)
    select v_analysis, r."indicatorName", r.facade, r.value, r.unit
    from jsonb_to_recordset(p_rows)
      as r ("indicatorName" text, facade text, value double precision, unit text)
    where r."indicatorName" in ('serviceDistance', 'serviceCount');
  return true;
end;
$$;

revoke all on function public.add_services(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.add_services(uuid, jsonb, jsonb) to authenticated;

-- 6. Finding the analyses of a plot quickly.
create index if not exists "Analysis_reuse_idx"
  on public."Analysis" ("plotID", "villaType", "landArea", "analysisDate" desc);
