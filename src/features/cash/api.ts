import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { CashSession, CashMovement, CashMovementKind, Payment } from '@/types/domain'

export async function fetchActiveCashSession(branchId: string): Promise<CashSession | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, opened_by_profile:profiles!cash_sessions_opened_by_fkey(*)')
      .eq('branch_id', branchId)
      .is('closed_at', null)
      .maybeSingle()
    if (!error && data) return data as CashSession
  }

  // Local demo session
  const stored = localStorage.getItem(`karachi_pos_active_session_${branchId}`)
  if (stored) return JSON.parse(stored)

  return null
}

export async function openCashSessionRpc(
  branchId: string,
  openingFloat: number,
  notes?: string
): Promise<{ id: string; opening_float: number; opened_at: string }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('open_cash_session', {
      p_branch_id: branchId,
      p_opening_float: openingFloat,
      p_notes: notes || null,
    })
    if (error) throw error
    return data
  }

  const newSession: CashSession = {
    id: crypto.randomUUID(),
    branch_id: branchId,
    opened_by: 'current-user',
    opened_at: new Date().toISOString(),
    opening_float: openingFloat,
    notes: notes || null,
  }
  localStorage.setItem(`karachi_pos_active_session_${branchId}`, JSON.stringify(newSession))
  window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_session' } }))
  window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_session' } }))
  return { id: newSession.id, opening_float: openingFloat, opened_at: newSession.opened_at }
}

export async function closeCashSessionRpc(
  sessionId: string,
  countedCash: number,
  notes?: string
): Promise<{
  id: string
  opening_float: number
  cash_sales: number
  expected_cash: number
  counted_cash: number
  variance: number
  closed_at: string
}> {
  const clearLocalSession = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('karachi_pos_active_session_')) {
          const raw = localStorage.getItem(k)
          if (raw) {
            const item = JSON.parse(raw)
            if (item.id === sessionId) localStorage.removeItem(k)
          }
        }
      }
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_session' } }))
    window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_session' } }))
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('close_cash_session', {
      p_session_id: sessionId,
      p_counted_cash: countedCash,
      p_notes: notes || null,
    })
    if (error) throw error
    clearLocalSession()
    return data
  }

  clearLocalSession()
  return {
    id: sessionId,
    opening_float: 5000,
    cash_sales: 18500,
    expected_cash: 23500,
    counted_cash: countedCash,
    variance: countedCash - 23500,
    closed_at: new Date().toISOString(),
  }
}

export async function recordCashMovementRpc(
  sessionId: string,
  kind: CashMovementKind,
  amount: number,
  reason: string
): Promise<{ id: string; amount: number; kind: string }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('record_cash_movement', {
      p_session_id: sessionId,
      p_kind: kind,
      p_amount: amount,
      p_reason: reason,
    })
    if (error) throw error
    window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_movement' } }))
    window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_movement' } }))
    return data
  }

  window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_movement' } }))
  window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_movement' } }))
  return { id: crypto.randomUUID(), amount, kind }
}

export async function fetchCashHistory(branchId: string): Promise<CashSession[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, opened_by_profile:profiles!cash_sessions_opened_by_fkey(*)')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(20)
    if (!error && data) return data as CashSession[]
  }

  return []
}

export async function fetchSessionDetails(sessionId: string): Promise<{
  payments: Payment[]
  movements: CashMovement[]
}> {
  if (isSupabaseConfigured) {
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('cash_session_id', sessionId)
      .eq('status', 'succeeded')

    const { data: movements } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false })

    return {
      payments: (payments || []) as Payment[],
      movements: (movements || []) as CashMovement[],
    }
  }

  return { payments: [], movements: [] }
}
