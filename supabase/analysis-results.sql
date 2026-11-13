-- Saves the indicators of a finished analysis (Analysis.results), so the history opens exactly what was
-- calculated then. Run it once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It only ADDS a column and a policy, nothing is deleted. Safe to run twice.
--
-- Uses the real schema: "Project"."analysisID" points to "Analysis"."analysisID",
-- and "Project"."userID" is the owner.

alter table "Analysis" add column if not exists "results" jsonb;

-- The owner of the project may update the results of their own analysis.
-- (If the table already has an update policy for its owner, you do not need this one.)
drop policy if exists "Owner updates own analysis results" on "Analysis";
create policy "Owner updates own analysis results"
  on "Analysis"
  for update
  to authenticated
  using (
    exists (
      select 1 from "Project" p
      where p."analysisID" = "Analysis"."analysisID"
        and p."userID" = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from "Project" p
      where p."analysisID" = "Analysis"."analysisID"
        and p."userID" = auth.uid()
    )
  );
