// How a server action's error reaches the browser. Next.js production builds
// replace a thrown action error with a generic "An error occurred in the Server
// Components render" (only a digest is sent), so actions wrapped with action()
// in lib/action-helpers.ts return { actionError } instead, and callers unwrap it.
// A plain module: client components import it.

/** An action's failure, returned rather than thrown so its message survives production */
export type ActionError = { actionError: string }

export function isActionError(result: unknown): result is ActionError {
  return typeof result === 'object' && result !== null && typeof (result as ActionError).actionError === 'string'
}

/**
 * Await a wrapped server action: its result, or its error thrown as a normal
 * Error — so callers keep their try/catch:  await unwrap(addGame(data))
 */
export async function unwrap<R>(pending: Promise<R | ActionError>): Promise<R> {
  const result = await pending
  if (isActionError(result)) throw new Error(result.actionError)
  return result
}
