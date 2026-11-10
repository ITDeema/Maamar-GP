// When the dashboard suggests a new analysis.
// 1. the user's role changed after the analysis was made (the account type in the profile), or
// 2. the analysis is older than this many months.
export const STALE_AFTER_MONTHS = 6;

// True when more than STALE_AFTER_MONTHS have passed since `isoDate` (an ISO date or time).
export function isStale(isoDate: string, now: number): boolean {
  const made = new Date(isoDate);
  if (Number.isNaN(made.getTime())) return false;
  const limit = new Date(made);
  limit.setUTCMonth(limit.getUTCMonth() + STALE_AFTER_MONTHS);
  return now > limit.getTime();
}
