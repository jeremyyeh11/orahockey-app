// Player names: the preferred name (what the app calls a player) and the full
// name split for highlighting it. Plain module — used by client and server code.

/** Default preferred name = first word of full_name, uppercased */
export function defaultPreferredName(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? '').toUpperCase()
}

/** Effective preferred name: explicit override or default from full_name */
export function preferredName(player: { full_name: string; preferred_name: string | null }): string {
  return (player.preferred_name?.trim() || defaultPreferredName(player.full_name)).toUpperCase()
}

export type NamePart = { text: string; highlight: boolean }

/**
 * The full name as highlighted / plain parts, in the full name's own word order.
 * Every word of the preferred name is highlighted wherever it appears, in any
 * order: "MAK RYAN" and "RYAN MAK" both give **MAK** RUI AN **RYAN**. A preferred
 * word may also sit inside a longer word ("ISH" in ISHWARPAL, "KEAEN" in
 * KEAEN-SETH). If a preferred word isn't in the full name at all, the preferred
 * name leads and the full name follows.
 */
export function nameParts(player: { full_name: string; preferred_name: string | null }): NamePart[] {
  const preferred = preferredName(player)
  const words = player.full_name.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const prefWords = preferred.split(/\s+/).filter(Boolean)

  // Highlighted [start, end) within each full-name word, or null
  const marks: ([number, number] | null)[] = words.map(() => null)
  for (const pw of prefWords) {
    let i = words.findIndex((w, k) => !marks[k] && w === pw)
    if (i === -1) i = words.findIndex((w, k) => !marks[k] && w.includes(pw))
    if (i === -1) {
      return [
        { text: preferred, highlight: true },
        { text: ` ${words.join(' ')}`, highlight: false },
      ]
    }
    const at = words[i] === pw ? 0 : words[i].indexOf(pw)
    marks[i] = [at, at + pw.length]
  }

  const parts: NamePart[] = []
  const push = (text: string, highlight: boolean) => {
    if (!text) return
    const last = parts[parts.length - 1]
    if (last && last.highlight === highlight) last.text += text
    else parts.push({ text, highlight })
  }
  words.forEach((w, k) => {
    if (k > 0) {
      // The space joins two highlighted words ("PEH YU") or sits in the plain text
      const prev = marks[k - 1]
      const joined = !!prev && prev[1] === words[k - 1].length && !!marks[k] && marks[k]![0] === 0
      push(' ', joined)
    }
    const m = marks[k]
    if (!m) return push(w, false)
    push(w.slice(0, m[0]), false)
    push(w.slice(m[0], m[1]), true)
    push(w.slice(m[1]), false)
  })
  return parts
}
