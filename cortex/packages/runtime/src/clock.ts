/** All demo timestamps render in IST regardless of host machine timezone. */
const IST_TZ = "Asia/Kolkata";

export function now(): Date {
  return new Date();
}

/** "07:02 AM" style label used in the activity stream and WhatsApp copy. */
export function timeLabel(date: Date = now()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "HH:MM" 24h, used for quiet-hours and scheduler comparisons. */
export function hhmm(date: Date = now()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function isoDate(date: Date = now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(date); // YYYY-MM-DD
}

export function dayOfMonth(date: Date = now()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST_TZ, day: "numeric" }).format(date),
  );
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}
