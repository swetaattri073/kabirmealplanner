/** Date helpers with no native-module imports (safe everywhere). */

export function formatBirthDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function parseBirthDate(iso: string): Date | null {
  const trimmed = iso.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function ageMonthsFromBirth(dob: Date): number {
  const today = new Date();
  let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
  if (today.getDate() < dob.getDate()) months -= 1;
  return months;
}
