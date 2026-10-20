import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
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
    try {
      const { data, error } = await supabase.rpc('open_cash_session', {
        p_branch_id: branchId,
        p_opening_float: openingFloat,
        p_notes: notes || null,
      })
      if (!error && data) {
        window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_session' } }))
        window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_session' } }))
        return data
      }
    } catch (err) {
      console.warn('Supabase open_cash_session error, using local fallback:', err)
    }
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
  const details = await fetchSessionDetails(sessionId)
  const totalCashSales = details.payments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const totalPayIns = details.movements
    .filter((m) => m.kind === 'pay_in')
    .reduce((acc, m) => acc + (m.amount || 0), 0)
  const totalPayOuts = details.movements
    .filter((m) => m.kind === 'pay_out' || m.kind === 'expense')
    .reduce((acc, m) => acc + (m.amount || 0), 0)

  // Find active session to get opening float and branchId
  let openingFloat = 5000
  let branchId = '635c7b14-54be-4b93-a75a-e2ddc0323827'
  let openedAt = new Date().toISOString()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('karachi_pos_active_session_')) {
        const raw = localStorage.getItem(k)
        if (raw) {
          const item = JSON.parse(raw)
          if (item.id === sessionId) {
            openingFloat = item.opening_float || 5000
            branchId = item.branch_id || branchId
            openedAt = item.opened_at || openedAt
            break
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const expectedCash = openingFloat + totalCashSales + totalPayIns - totalPayOuts
  const variance = countedCash - expectedCash
  const closedAt = new Date().toISOString()

  const closedRecord: CashSession = {
    id: sessionId,
    branch_id: branchId,
    opened_by: 'current-user',
    opened_at: openedAt,
    opening_float: openingFloat,
    closed_at: closedAt,
    expected_cash: expectedCash,
    counted_cash: countedCash,
    variance: variance,
    notes: notes || null,
  }

  // Save to cash history
  const histKey = `kpos_cash_history_${branchId}`
  try {
    const rawHist = localStorage.getItem(histKey)
    const histList: CashSession[] = rawHist ? JSON.parse(rawHist) : []
    histList.unshift(closedRecord)
    localStorage.setItem(histKey, JSON.stringify(histList))
  } catch {
    // ignore
  }

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
    try {
      const { data, error } = await supabase.rpc('close_cash_session', {
        p_session_id: sessionId,
        p_counted_cash: countedCash,
        p_notes: notes || null,
      })
      if (!error && data) {
        clearLocalSession()
        return data
      }
    } catch (err) {
      console.warn('Supabase close_cash_session error, using local fallback:', err)
    }
  }

  clearLocalSession()
  return {
    id: sessionId,
    opening_float: openingFloat,
    cash_sales: totalCashSales,
    expected_cash: expectedCash,
    counted_cash: countedCash,
    variance: variance,
    closed_at: closedAt,
  }
}

export async function recordCashMovementRpc(
  sessionId: string,
  kind: CashMovementKind,
  amount: number,
  reason: string,
  branchId?: string
): Promise<{ id: string; amount: number; kind: string }> {
  // Always record to local storage movements for instant persistence
  const newMovement: CashMovement = {
    id: crypto.randomUUID(),
    branch_id: branchId || 'branch-1',
    cash_session_id: sessionId,
    kind,
    amount,
    reason,
    created_by: 'current-user',
    created_at: new Date().toISOString(),
  }

  const key = `kpos_cash_movements_${sessionId}`
  try {
    const raw = localStorage.getItem(key)
    const list: CashMovement[] = raw ? JSON.parse(raw) : []
    list.unshift(newMovement)
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('record_cash_movement', {
        p_session_id: sessionId,
        p_kind: kind,
        p_amount: amount,
        p_reason: reason,
      })
      if (!error && data) {
        window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_movement' } }))
        window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_movement' } }))
        return data
      }
    } catch (err) {
      console.warn('Supabase record_cash_movement error, using local fallback:', err)
    }
  }

  window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key: 'cash_movement' } }))
  window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key: 'cash_movement' } }))
  return { id: newMovement.id, amount, kind }
}

export async function fetchCashHistory(branchId: string): Promise<CashSession[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*, opened_by_profile:profiles!cash_sessions_opened_by_fkey(*)')
        .eq('branch_id', branchId)
        .order('opened_at', { ascending: false })
        .limit(20)
      if (!error && data && data.length > 0) return data as CashSession[]
    } catch {
      // ignore
    }
  }

  try {
    const raw = localStorage.getItem(`kpos_cash_history_${branchId}`)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }

  return []
}

export async function fetchSessionDetails(sessionId: string): Promise<{
  payments: Payment[]
  movements: CashMovement[]
}> {
  // 1. Retrieve local movements
  const key = `kpos_cash_movements_${sessionId}`
  let localMovements: CashMovement[] = []
  try {
    const rawMovements = localStorage.getItem(key)
    if (rawMovements) localMovements = JSON.parse(rawMovements)
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
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

      if (movements && movements.length > 0) {
        localMovements = movements as CashMovement[]
      }

      if (payments && payments.length > 0) {
        return {
          payments: payments as Payment[],
          movements: localMovements,
        }
      }
    } catch (err) {
      console.warn('Supabase fetchSessionDetails error, falling back to local Storage:', err)
    }
  }

  // 2. Fallback: Cash payments collected from Storage orders
  const orders = Storage.getOrders()
  const cashPayments: Payment[] = []
  orders.forEach((o) => {
    if (o.status !== 'cancelled' && Array.isArray(o.payments)) {
      o.payments.forEach((p) => {
        if (p.method === 'cash') {
          cashPayments.push(p as Payment)
        }
      })
    }
  })

  return { payments: cashPayments, movements: localMovements }
}
