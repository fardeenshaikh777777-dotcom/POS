import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import { normalizePhoneNumber } from '@/lib/phoneNormalizer'
import type { Customer, Order, TableReservation, MarketingConsent } from '@/types/domain'

export async function fetchCustomersList(
  branchId: string,
  search?: string,
  consentFilter?: MarketingConsent | 'all'
): Promise<Customer[]> {
  if (isSupabaseConfigured) {
    let q = supabase
      .from('customers')
      .select('*')
      .eq('branch_id', branchId)
      .order('total_spent', { ascending: false })

    if (consentFilter && consentFilter !== 'all') {
      q = q.eq('marketing_consent', consentFilter)
    }

    if (search?.trim()) {
      const s = search.trim()
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`)
    }

    const { data, error } = await q
    if (!error && data && data.length > 0) return data as Customer[]
  }

  return Storage.getCustomers(branchId, search, consentFilter)
}

export async function createCustomerRecord(branchId: string, customer: Partial<Customer>): Promise<Customer> {
  if (!customer.name?.trim()) throw new Error('Customer name is required')
  if (!customer.phone?.trim()) throw new Error('Customer phone number is required')

  const phoneClean = customer.phone.trim()
  const normalizedPhone = normalizePhoneNumber(phoneClean)

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('customers')
      .upsert(
        {
          branch_id: branchId,
          name: customer.name.trim(),
          phone: normalizedPhone,
          email: customer.email?.trim() || null,
          address: customer.address?.trim() || null,
          notes: customer.notes?.trim() || null,
          marketing_consent: customer.marketing_consent || 'unspecified',
          marketing_consent_at: customer.marketing_consent ? new Date().toISOString() : null,
          marketing_consent_source: customer.marketing_consent_source || 'direct',
        },
        { onConflict: 'branch_id,phone' }
      )
      .select()
      .single()

    if (error) throw error
    try {
      Storage.saveCustomer(branchId, { ...customer, phone: normalizedPhone })
    } catch {
      // local sync
    }
    return data as Customer
  }

  return Storage.saveCustomer(branchId, customer)
}

export async function updateCustomerConsent(
  _branchId: string,
  customerId: string,
  consent: MarketingConsent,
  source = 'staff_update'
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('customers')
      .update({
        marketing_consent: consent,
        marketing_consent_at: new Date().toISOString(),
        marketing_consent_source: source,
      })
      .eq('id', customerId)

    if (error) console.warn('Supabase consent update failed:', error)
  }

  Storage.updateCustomerConsent(customerId, consent, source)
}

export async function fetchCustomerOrderHistory(branchId: string, phone: string): Promise<Order[]> {
  const normalized = normalizePhoneNumber(phone)
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('branch_id', branchId)
      .or(`customer_phone.eq.${phone},customer_phone.eq.${normalized}`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error && data && data.length > 0) return data as Order[]
  }

  const allOrders = Storage.getOrders(branchId)
  return allOrders.filter(
    (o) => o.customer_phone === phone || (o.customer_phone && normalizePhoneNumber(o.customer_phone) === normalized)
  )
}

export async function fetchCustomerReservationHistory(
  branchId: string,
  customerIdOrPhone: string
): Promise<TableReservation[]> {
  const normalized = normalizePhoneNumber(customerIdOrPhone)
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('table_reservations')
      .select('*, table:dining_tables(*)')
      .eq('branch_id', branchId)
      .or(`customer_id.eq.${customerIdOrPhone},customer_phone.eq.${customerIdOrPhone},customer_phone.eq.${normalized}`)
      .order('reservation_time', { ascending: false })
      .limit(20)
    if (!error && data && data.length > 0) return data as TableReservation[]
  }

  const allReservations = Storage.getReservations(branchId)
  return allReservations.filter(
    (r) =>
      r.customer_id === customerIdOrPhone ||
      r.customer_phone === customerIdOrPhone ||
      (r.customer_phone && normalizePhoneNumber(r.customer_phone) === normalized)
  )
}
