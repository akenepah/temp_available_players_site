export const UNAVAILABLE = "—";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-27" → "2026–27" (en dash, as set in the approved screens). */
export function formatSeason(season: string): string {
  return season.replace("-", "–");
}

/** "2026-09-23" → "Sep 23, 2026". Parsed as a calendar date, never shifted by time zone. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function formatCount(value: number | null): string {
  return value === null ? UNAVAILABLE : String(value);
}

/** Yahoo ADP: whole picks as-is, fractional ADP to one decimal. */
export function formatAdp(value: number | null): string {
  if (value === null) return UNAVAILABLE;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 0.912 → ".912" */
export function formatSavePct(value: number | null): string {
  if (value === null) return UNAVAILABLE;
  return value.toFixed(3).replace(/^0/, "");
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
