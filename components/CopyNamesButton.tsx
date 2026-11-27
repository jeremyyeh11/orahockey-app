'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

/**
 * Icon-only copy button beside a "Hasn't responded" / "Hasn't voted" heading: copies
 * the names (see lib/chase.ts) so anyone can paste them into a group chat to chase replies.
 * The icon turns into a green tick for 2s once copied.
 */
export function CopyNamesButton({ text, label }: { text: string; label: string }) {
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
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={`liga-copy-names -my-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition ${
        copied ? 'text-green-400' : 'text-slate-500 hover:text-white'
      }`}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  )
}
