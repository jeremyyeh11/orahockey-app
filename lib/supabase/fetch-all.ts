// The Supabase API returns at most 1000 rows per request — anything past that
// is silently dropped (attendance passed 1000 rows with the 2024/2025 imports).
// fetchAll pages through with range() until a short page comes back.

const PAGE = 1000

type Page<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Every row of a select, however many. `build` makes the query afresh for each
 * page — order it by a unique column (e.g. `.order('id')`) so pages don't
 * overlap or skip rows.
 *
 *   const { data } = await fetchAll(() => supabase.from('attendance').select('player_id, session_id').order('id'))
 */
export async function fetchAll<T = any>(build: () => { range(from: number, to: number): PromiseLike<Page<T>> }): Promise<Page<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return { data: rows, error: null }
  }
}
