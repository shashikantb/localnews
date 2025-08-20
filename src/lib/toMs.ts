
// src/lib/toMs.ts
export const toMs = (v: unknown): number => {
  if (!v) return 0;

  // String: accept "YYYY-MM-DD HH:mm:ss+00" or ISO; normalize the space to 'T'
  if (typeof v === 'string') {
    const s = v.includes('T') ? v : v.replace(' ', 'T');
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? 0 : ms;
  }

  // Date
  if (v instanceof Date) return v.getTime();

  // Number (already ms or seconds — treat values < 10^12 as seconds)
  if (typeof v === 'number') return v < 1e12 ? Math.floor(v * 1000) : v;

  // Firestore Timestamp-like
  // { seconds, nanoseconds } or _seconds/_nanoseconds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = v as any;
  if (typeof any?.toDate === 'function') return any.toDate().getTime();
  if (typeof any?.seconds === 'number') return any.seconds * 1000 + Math.floor((any.nanoseconds ?? 0) / 1e6);
  if (typeof any?._seconds === 'number') return any._seconds * 1000 + Math.floor((any._nanoseconds ?? 0) / 1e6);

  return 0;
};
