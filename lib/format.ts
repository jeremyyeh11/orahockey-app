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
