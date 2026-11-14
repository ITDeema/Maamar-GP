-- One row in "Plot" for each plot (parcel), as the ER diagram says (Plot 1 — 1..* Analysis).
-- A plot is recognised by its boundary from the Riyadh parcels layer: any click inside the same
-- house gives the same boundary, so it finds the same Plot row. The plot keeps its own facts
-- (boundary, real area, land use, neighbourhood, main facade); the user's inputs (area, height,
-- villa type) belong to the Analysis.
-- Run it once in Supabase -> SQL Editor, AFTER maamar_database.sql. Safe to run twice.

-- 1. The key that makes a boundary unique (older rows have no boundary, so their key is null).
alter table public."Plot"
  add column if not exists "boundaryKey" text
  generated always as (md5("boundaryGeometry"::text)) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'Plot_boundaryKey_key') then
    alter table public."Plot" add constraint "Plot_boundaryKey_key" unique ("boundaryKey");
  end if;
end $$;

-- 2. create_analysis: finds or creates the plot, then saves the analysis (with the height)
--    and the project. The old version (5 inputs) is replaced.
drop function if exists public.create_analysis(double precision, double precision, double precision, text, text);

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

  -- Only residential plots are analysed: there must be a plot (not a street or empty point), and its
  -- land use, when known, must include residential (e.g. "سكني" or "سكني تجاري").
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
  -- details that were missing the first time are filled in, nothing is overwritten
  update public."Plot" set
    zoning        = coalesce(zoning, p_zoning),
    neighbourhood = coalesce(neighbourhood, p_neighbourhood),
    orientation   = coalesce(orientation, p_orientation)
  where "plotID" = v_plot;

  insert into public."Analysis" ("plotID", "villaType", "landArea", "expectedBuildingHeight")
    values (v_plot, p_villa_type, p_area, p_height)
    returning "analysisID" into v_analysis;

  insert into public."Project" ("userID", "analysisID", "projectName", lat, lng, "roleAtAnalysis")
    values (v_user, v_analysis, btrim(p_name), p_lat, p_lng, v_role)
    returning "projectID" into v_project;

  return v_project;
end;
$$;

revoke all on function public.create_analysis(
  double precision, double precision, double precision, text, text,
  double precision, jsonb, double precision, text, text, text
) from public, anon;
grant execute on function public.create_analysis(
  double precision, double precision, double precision, text, text,
  double precision, jsonb, double precision, text, text, text
) to authenticated;
