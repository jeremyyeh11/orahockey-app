'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

/**
 * Copy icon + short label ("Hasn't responded" / "Hasn't voted"), in the Fines tab's copy-button
 * style: copies who still hasn't replied to an event or voted on a poll (see lib/chase.ts) so
 * anyone can paste it into a group chat to chase them. A tick and "Copied" for 2s afterwards.
 */
export function CopyNamesButton({
  text,
  label,
  title,
  className = '',
}: {
  text: string
  /** Short visible label */
  label: string
  /** Fuller description for the tooltip / screen readers */
  title: string
  className?: string
}) {
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
      title={title}
      aria-label={copied ? 'Copied' : title}
      className={`liga-button liga-button-secondary liga-copy-names inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:text-white ${
        copied ? 'text-green-400' : 'text-slate-300'
      } ${className}`}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
