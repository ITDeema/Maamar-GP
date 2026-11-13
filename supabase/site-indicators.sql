-- Saves the indicators of an analysis as rows in "Site_Indicator" (one row per indicator, and per
-- facade for the facade indicators), as the ER diagram says. The website calls this function right
-- after it saves Analysis.results. Run it once in Supabase -> SQL Editor, AFTER maamar_database.sql.
-- Safe to run twice. Saving again for the same project replaces the old rows of that analysis.
--
-- Why a function: the browser has no policy on "Site_Indicator" (only the backend writes it), so the
-- function (security definer) checks that the project belongs to the signed-in user, then writes.

create or replace function public.save_site_indicators(
  p_project uuid,
  p_rows    jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_analysis uuid;
  v_count    integer;
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

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  delete from public."Site_Indicator" where "analysisID" = v_analysis;

  insert into public."Site_Indicator" ("analysisID", "indicatorName", facade, value, unit)
    select v_analysis, r."indicatorName", r.facade, r.value, r.unit
    from jsonb_to_recordset(p_rows)
      as r ("indicatorName" text, facade text, value double precision, unit text)
    where r."indicatorName" is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.save_site_indicators(uuid, jsonb) from public, anon;
grant execute on function public.save_site_indicators(uuid, jsonb) to authenticated;
