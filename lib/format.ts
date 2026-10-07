// Date helpers — everything is displayed in Singapore time so server
// (UTC on Vercel) and client render identically. SG has no DST, so the
// +08:00 offset is a safe constant.

export const TZ = 'Asia/Singapore'

function parts(iso: string) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(iso))) map[p.type] = p.value
  return map
}

/** 'Sun 8 Feb' */
export function fmtDate(iso: string) {
  const p = parts(iso)
  return `${p.weekday} ${p.day} ${p.month}`
}

/** '18:00' */
export function fmtTime(iso: string) {
  const p = parts(iso)
  return `${p.hour}:${p.minute}`
}

/** 'Sun 8 Feb · 18:00' */
export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`
}

/** { day: '8', mon: 'Feb' } — for calendar-style date blocks */
export function dateBlock(iso: string) {
  const p = parts(iso)
  return { day: p.day, mon: p.month }
}

/** ISO → 'YYYY-MM-DDTHH:mm' in SG time, for <input type="datetime-local"> */
export function toDatetimeLocal(iso: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(iso))) map[p.type] = p.value
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

/** 'YYYY-MM-DDTHH:mm' (SG wall time) → ISO string */
export function fromDatetimeLocal(value: string) {
  return new Date(`${value}:00+08:00`).toISOString()
}

const sgDay = (iso: string) => toDatetimeLocal(iso).slice(0, 10)

/** ISO → 'HH:mm' in SG time, for <input type="time"> */
export function toTimeLocal(iso: string) {
  return toDatetimeLocal(iso).slice(11, 16)
}

/**
 * An end time picked as 'HH:mm' → ISO, on the start's (SG) day. At or before the
 * start it means the next day (it runs past midnight). '' → null (no end time).
 */
export function endFromTime(startIso: string, hhmm: string | null | undefined): string | null {
  if (!hhmm) return null
  const end = new Date(`${sgDay(startIso)}T${hhmm}:00+08:00`)
  if (end.getTime() <= new Date(startIso).getTime()) end.setTime(end.getTime() + 24 * 60 * 60 * 1000)
  return end.toISOString()
}

/** 'Sat 10 Oct · 09:00 – 11:00'; the end's date only shows when it's another day */
export function fmtDateTimeRange(startIso: string, endIso?: string | null) {
  if (!endIso) return fmtDateTime(startIso)
  return sgDay(startIso) === sgDay(endIso)
    ? `${fmtDateTime(startIso)} – ${fmtTime(endIso)}`
    : `${fmtDateTime(startIso)} – ${fmtDateTime(endIso)}`
}

/** Times only, for rows that already show the date: '09:00 – 11:00' (or '22:00 – Sun 11 Oct · 01:00') */
export function fmtTimeRange(startIso: string, endIso?: string | null) {
  if (!endIso) return fmtTime(startIso)
  return sgDay(startIso) === sgDay(endIso)
    ? `${fmtTime(startIso)} – ${fmtTime(endIso)}`
    : `${fmtTime(startIso)} – ${fmtDateTime(endIso)}`
}

/** 'Report 08:45 · 15 min early' — null when there's no report time */
export function fmtReport(startIso: string, minutes: number | null | undefined) {
  if (!minutes) return null
  const at = new Date(new Date(startIso).getTime() - minutes * 60 * 1000).toISOString()
  return `Report ${fmtTime(at)} · ${minutes} min early`
}
