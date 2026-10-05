/** Shared made-to-order delivery estimate helpers (used by the site and by email). */

export const DELIVERY_BUSINESS_DAYS = 20;

export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return d;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic formatting — Intl locale data differs across runtimes. */
export function formatDate(d: Date) {
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

export function estimatedDelivery(placedAt: string | Date) {
  const placed = typeof placedAt === "string" ? new Date(placedAt) : placedAt;
  return formatDate(addBusinessDays(placed, DELIVERY_BUSINESS_DAYS));
}
