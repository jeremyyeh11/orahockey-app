import { getRequestUser } from '@/lib/supabase/request-user'
import { createClient } from '@/lib/supabase/server'
import { getNow } from '@/lib/preview'
import { loadFines } from '@/lib/fines-server'
import { fineMonth, monthLabel, sgMonth, shiftMonth } from '@/lib/fines'
import FinesClient from '@/components/FinesClient'

/**
 * The Fines page for players and admins: one month at a time (`?month=YYYY-MM`,
 * default this month), everyone's fines. Admins get waive buttons.
 */
export async function FinesView({ basePath, month }: { basePath: '/dashboard' | '/admin'; month?: string }) {
  const user = await getRequestUser()
  const [{ data: me }, { fines, players }] = await Promise.all([
    createClient().from('players').select('id').eq('auth_user_id', user?.id ?? '').maybeSingle(),
    loadFines(),
  ])

  const thisMonth = sgMonth(getNow())
  const shown = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : thisMonth
  const href = (m: string) => `${basePath}/fines?month=${m}`

  return (
    <FinesClient
      month={shown}
      monthTitle={monthLabel(shown)}
      prevHref={href(shiftMonth(shown, -1))}
      nextHref={shown < thisMonth ? href(shiftMonth(shown, 1)) : null}
      fines={fines.filter((f) => fineMonth(f) === shown)}
      players={Object.fromEntries(Array.from(players, ([id, p]) => [id, { full_name: p.full_name, preferred_name: p.preferred_name }]))}
      myPlayerId={me?.id ?? null}
      isAdmin={basePath === '/admin'}
      basePath={basePath}
    />
  )
}
