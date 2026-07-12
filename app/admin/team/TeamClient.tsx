'use client'

import { useState, useTransition, useRef } from 'react'
import { addPlayer, updatePlayer, togglePlayerActive, importPlayers } from './actions'

type Player = {
  id: string
  full_name: string
  email: string
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
  is_active: boolean
  auth_user_id: string | null
}

type FormData = {
  full_name: string
  email: string
  jersey_number: number | null
  position: string[] | null
  role: 'player' | 'admin'
}

const POSITIONS = ['FWD', 'MID', 'DEF', 'GK'] as const

const POSITION_COLORS: Record<string, string> = {
  FWD: 'bg-orange-900/50 text-orange-300',
  MID: 'bg-green-900/50 text-green-300',
  DEF: 'bg-blue-900/50 text-blue-300',
  GK: 'bg-purple-900/50 text-purple-300',
}

export default function TeamClient({ players }: { players: Player[] }) {
  const [showModal, setShowModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const visible = showInactive ? players : players.filter(p => p.is_active)

  function openAdd() {
    setEditingPlayer(null)
    setSelectedPositions([])
    setError(null)
    setShowModal(true)
  }

  function openEdit(player: Player) {
    setEditingPlayer(player)
    setSelectedPositions(player.position ?? [])
    setError(null)
    setShowModal(true)
  }

  function togglePosition(pos: string) {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    )
  }

  function closeModal() {
    setShowModal(false)
    setEditingPlayer(null)
    setError(null)
  }

  function parseForm(form: HTMLFormElement): FormData {
    const fd = new FormData(form)
    const jerseyRaw = fd.get('jersey_number') as string
    return {
      full_name: fd.get('full_name') as string,
      email: fd.get('email') as string,
      jersey_number: jerseyRaw ? Number(jerseyRaw) : null,
      position: selectedPositions.length > 0 ? selectedPositions : null,
      role: fd.get('role') as 'player' | 'admin',
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = parseForm(e.currentTarget)
    setError(null)

    startTransition(async () => {
      try {
        if (editingPlayer) {
          await updatePlayer(editingPlayer.id, data)
        } else {
          await addPlayer(data)
        }
        closeModal()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so same file can be re-selected

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      // Skip header row
      const rows = lines.slice(1).map(line => {
        const [name, email, admin] = line.split(',').map(c => c.trim())
        const isAdmin = /^(true|yes|1|admin)$/i.test(admin ?? '')
        return { full_name: name, email, role: (isAdmin ? 'admin' : 'player') as 'player' | 'admin' }
      }).filter(r => r.full_name && r.email)

      if (rows.length === 0) {
        setImportStatus('No valid rows found in CSV.')
        return
      }

      setImportStatus(`Importing ${rows.length} players…`)
      startTransition(async () => {
        try {
          const { imported } = await importPlayers(rows)
          const skipped = rows.length - imported
          setImportStatus(
            skipped > 0
              ? `Imported ${imported} players. ${skipped} skipped (duplicate email).`
              : `Imported ${imported} players.`
          )
        } catch (err) {
          setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      })
    }
    reader.readAsText(file)
  }

  function handleToggleActive(player: Player) {
    startTransition(async () => {
      await togglePlayerActive(player.id, !player.is_active)
    })
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Team</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={isPending}
            className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition disabled:opacity-40"
          >
            Import CSV
          </button>
          <button
            onClick={openAdd}
            className="bg-accent rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110"
          >
            + Add Player
          </button>
        </div>
      </div>

      {/* Hidden CSV file input */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCSV}
      />

      {/* Import status */}
      {importStatus && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
          <span>{importStatus}</span>
          <button onClick={() => setImportStatus(null)} className="ml-3 text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-4 mb-4 text-sm text-slate-400">
        <span>{players.filter(p => p.is_active).length} active</span>
        {players.some(p => !p.is_active) && (
          <span>{players.filter(p => !p.is_active).length} inactive</span>
        )}
        <span>{players.filter(p => p.auth_user_id).length} linked</span>
      </div>

      {/* Show inactive toggle */}
      {players.some(p => !p.is_active) && (
        <label className="flex items-center gap-2 text-sm text-slate-400 mb-4 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded accent-brand"
          />
          Show inactive
        </label>
      )}

      {/* Player list */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-slate-500 text-sm py-4 text-center">No players yet. Add one above.</p>
        )}
        {visible.map(player => (
          <div
            key={player.id}
            className={`rounded-xl border border-surface-border bg-surface-card px-4 py-3 flex items-stretch gap-3 transition ${
              !player.is_active ? 'opacity-50' : ''
            }`}
          >
            {/* Jersey # — sized to match name+position block height */}
            <div className="shrink-0 w-9 flex items-center justify-center font-bold text-slate-400 text-2xl leading-none">
              {player.jersey_number != null ? `#${player.jersey_number}` : '—'}
            </div>

            {/* Name + position badges */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="font-semibold text-white truncate">{player.full_name}</div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {player.position?.map(pos => (
                  <span key={pos} className={`rounded px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? 'bg-slate-700 text-slate-300'}`}>
                    {pos}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: meta (admin/linked) + Edit */}
            <div className="shrink-0 flex flex-col items-end justify-between">
              <div className="flex items-center gap-1.5">
                {player.role === 'admin' && (
                  <span className="text-[10px] text-slate-500">admin</span>
                )}
                <span className={`text-[10px] ${player.auth_user_id ? 'text-green-700' : 'text-slate-700'}`}>
                  {player.auth_user_id ? '● linked' : '○ unlinked'}
                </span>
              </div>
              <button
                onClick={() => openEdit(player)}
                className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-700"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} />

          {/* Sheet / modal */}
          <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface-card border border-surface-border px-6 pt-6 pb-8 shadow-xl">
            {/* Handle (mobile) */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />

            <h2 className="text-lg font-bold text-white mb-5">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                <input
                  name="full_name"
                  type="text"
                  required
                  defaultValue={editingPlayer?.full_name}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editingPlayer?.email}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="player@example.com"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Jersey #</label>
                  <input
                    name="jersey_number"
                    type="number"
                    min="1"
                    max="99"
                    defaultValue={editingPlayer?.jersey_number ?? ''}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    placeholder="—"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Position</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {POSITIONS.map(pos => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => togglePosition(pos)}
                        className={`rounded-lg px-2.5 py-2 text-xs font-semibold border transition ${
                          selectedPositions.includes(pos)
                            ? `${POSITION_COLORS[pos]} border-transparent`
                            : 'border-surface-border text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  name="role"
                  defaultValue={editingPlayer?.role ?? 'player'}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="player">Player</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-surface-border py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
