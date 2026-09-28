export function formatScheduledAt(value, locale) {
  if (value === null || value === undefined || value === "") return "Date unavailable";

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return date.toLocaleString(locale);
}
