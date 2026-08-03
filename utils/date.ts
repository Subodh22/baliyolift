/**
 * Local-timezone date keys ("YYYY-MM-DD").
 *
 * IMPORTANT: food logging keys days by the user's LOCAL calendar day, not UTC.
 * `new Date().toISOString().split("T")[0]` returns the UTC day, which is off by
 * one for large parts of the day in any non-UTC timezone (e.g. en-AU is UTC+10:
 * anything logged before ~10am local lands on the previous UTC day and then
 * never shows up on today's Fuel view). Always build day keys from the local
 * calendar fields so writers (meal-plans, add-food) and readers (Fuel's
 * getDayEntries) agree on which day an entry belongs to.
 */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Today's local day key ("YYYY-MM-DD"). */
export function todayStr(): string {
  return localDateStr();
}

/** Shift a "YYYY-MM-DD" key by whole days, staying on local calendar days. */
export function offsetDateStr(base: string, days: number): string {
  // Anchor at local noon so a ±day shift never crosses a DST boundary into the
  // wrong calendar day.
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
