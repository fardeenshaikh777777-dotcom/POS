/** Convert unknown thrown values (incl. Supabase/Postgrest errors) to a safe user message. */
export class AppError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'AppError'
  }
}

const FRIENDLY: Record<string, string> = {
  '42501': 'You do not have permission to do that.',
  '23505': 'That record already exists.',
  '23503': 'This record is referenced by other data.',
  '23514': 'The values provided are not valid.',
  PGRST301: 'Your session has expired. Please sign in again.',
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (typeof err === 'object' && err !== null) {
    const e = err as { code?: string; message?: string }
    if (e.code && FRIENDLY[e.code]) return FRIENDLY[e.code]
    if (e.message === 'Failed to fetch') return 'Cannot reach the server. Check your connection.'
  }
  return 'Something went wrong. Please try again.'
}
