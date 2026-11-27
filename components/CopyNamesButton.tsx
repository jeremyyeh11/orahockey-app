'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Labelled copy button (same style as the Fines tab's "Copy all outstanding for WhatsApp"):
 * copies who still hasn't replied to an event or voted on a poll (see lib/chase.ts) so anyone
 * can paste it into a group chat to chase them. Reads "Copied" for 2s afterwards.
 */
export function CopyNamesButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`liga-button liga-button-secondary liga-copy-names rounded-lg border text-xs font-semibold text-slate-300 transition hover:text-white ${className}`}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
