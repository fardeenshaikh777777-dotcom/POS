import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Expense, PaymentMethod } from '@/types/domain'

export async function fetchExpenses(branchId: string): Promise<Expense[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data && data.length > 0) return data as Expense[]
  }

  return Storage.getExpenses(branchId)
}

export async function recordExpenseRpc(params: {
  branchId: string
  category: Expense['category']
  amount: number
  paymentMethod: PaymentMethod
  cashSessionId?: string | null
  description: string
  vendor?: string | null
}): Promise<{ id: string; amount: number; category: string }> {
  if (params.amount <= 0) throw new Error('Expense amount must be greater than zero')
  if (!params.description.trim()) throw new Error('Description is required')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('record_expense', {
      p_branch_id: params.branchId,
      p_category: params.category,
      p_amount: params.amount,
      p_payment_method: params.paymentMethod,
      p_cash_session_id: params.cashSessionId || null,
      p_description: params.description.trim(),
      p_vendor: params.vendor?.trim() || null,
    })
    if (error) throw error
    try {
      Storage.recordExpense(params)
    } catch {
      // local sync
    }
    return data
  }

  const exp = Storage.recordExpense(params)
  return { id: exp.id, amount: exp.amount, category: exp.category }
}
