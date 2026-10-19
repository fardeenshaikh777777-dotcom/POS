import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Customer, Order } from '@/types/domain'

export async function fetchCustomersList(branchId: string, search?: string): Promise<Customer[]> {
  if (isSupabaseConfigured) {
    let q = supabase
      .from('customers')
      .select('*')
      .eq('branch_id', branchId)
      .order('total_spent', { ascending: false })

    if (search?.trim()) {
      const s = search.trim()
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`)
    }

    const { data, error } = await q
    if (!error && data && data.length > 0) return data as Customer[]
  }

  return Storage.getCustomers(branchId, search)
}

export async function createCustomerRecord(branchId: string, customer: Partial<Customer>): Promise<Customer> {
  if (!customer.name?.trim()) throw new Error('Customer name is required')
  if (!customer.phone?.trim()) throw new Error('Customer phone number is required')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('customers')
      .upsert(
        {
          branch_id: branchId,
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email?.trim() || null,
          address: customer.address?.trim() || null,
          notes: customer.notes?.trim() || null,
        },
        { onConflict: 'branch_id,phone' }
      )
      .select()
      .single()

    if (error) throw error
    try {
      Storage.saveCustomer(branchId, customer)
    } catch {
      // local sync
    }
    return data as Customer
  }

  return Storage.saveCustomer(branchId, customer)
}

export async function fetchCustomerOrderHistory(branchId: string, phone: string): Promise<Order[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('branch_id', branchId)
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!error && data && data.length > 0) return data as Order[]
  }

  const allOrders = Storage.getOrders(branchId)
  return allOrders.filter((o) => o.customer_phone === phone)
}
