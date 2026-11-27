// Text for chasing replies in a group chat: who still hasn't answered an event or voted on a poll.

/** A heading line, then one name per line — ready to paste into WhatsApp */
export function chaseText(heading: string, names: string[]) {
  return [`${heading}:`, ...names].join('\n')
}
