// Calendar dates are plain "YYYY-MM-DD" strings everywhere (DB column is DATE),
// so a UTC shift can never move a due date by a day.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in Asia/Kolkata. IST has no DST, so a fixed offset is exact. */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Overdue = not repaid and due date strictly before today (IST). Due today is NOT overdue. */
export function isOverdue(dueDate: string, repaidAt: string | null, today: string = todayIST()): boolean {
  return repaidAt === null && dueDate < today;
}

export function daysOverdue(dueDate: string, repaidAt: string | null, today: string = todayIST()): number {
  return isOverdue(dueDate, repaidAt, today) ? daysBetween(dueDate, today) : 0;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
