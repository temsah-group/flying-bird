// Arabic words, Western digits (Arabic-Indic ٥ looks like 0 in charts)
const LOCALE = "ar-EG-u-nu-latn";
const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const nf = new Intl.NumberFormat(LOCALE);

export const formatNumber = (n) => nf.format(n || 0);

export function timeAgo(date) {
  if (!date) return "—";
  const diffSec = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(date);
}

export function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(LOCALE, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function shortDay(isoDay) {
  // "2026-10-18" -> "18 أكتوبر"
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}
