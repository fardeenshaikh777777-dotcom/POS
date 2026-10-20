import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import { getKarachiBusinessDate } from '@/lib/format'
import type { MenuCategory, MenuItem, DiningTable, Customer, Order, OrderType, PaymentMethod } from '@/types/domain'

// Local storage key for offline order queue
const OFFLINE_QUEUE_KEY = 'karachi_pos_offline_orders'

export interface CreateOrderParams {
  branchId: string
  clientRequestId: string
  type: OrderType
  tableId?: string | null
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  deliveryAddress?: string | null
  notes?: string | null
  dealId?: string | null
  dealDiscount?: number
  discount?: number
  deliveryFee?: number
  items: Array<{
    menu_item_id: string
    quantity: number
    notes?: string | null
  }>
}

export interface SettlePaymentParams {
  branchId: string
  orderId: string
  method: PaymentMethod
  amount: number
  idempotencyKey: string
  cashSessionId?: string | null
  providerRef?: string | null
}

export async function fetchMenuCategories(branchId: string): Promise<MenuCategory[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) return data as MenuCategory[]
  }
  return Storage.getCategories(branchId)
}

export async function fetchMenuItems(branchId: string): Promise<MenuItem[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true })
    if (!error && data && data.length > 0) return data as MenuItem[]
  }
  return Storage.getMenuItems(branchId)
}

export async function fetchDiningTables(branchId: string): Promise<DiningTable[]> {
  if (isSupabaseConfigured) {
    const { data: tables, error: tErr } = await supabase
      .from('dining_tables')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('label', { ascending: true })

    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, table_id, status')
      .eq('branch_id', branchId)
      .not('table_id', 'is', null)
      .in('status', ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served'])

    if (!tErr && tables) {
      return tables.map((t) => {
        const active = activeOrders?.find((o) => o.table_id === t.id)
        return {
          ...t,
          current_order_id: active?.id ?? null,
          current_order_status: active?.status ?? null,
        }
      }) as DiningTable[]
    }
  }
  return Storage.getTables(branchId)
}

export async function searchCustomers(branchId: string, phoneQuery: string): Promise<Customer[]> {
  if (!phoneQuery.trim()) return []
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('branch_id', branchId)
      .ilike('phone', `%${phoneQuery.trim()}%`)
      .limit(5)
    if (!error && data) return data as Customer[]
  }
  return []
}

export async function createOrder(params: CreateOrderParams): Promise<{
  id: string
  order_number: number
  subtotal: number
  tax: number
  total: number
  status: string
  is_duplicate_replay: boolean
}> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('create_order', {
      p_branch_id: params.branchId,
      p_client_request_id: params.clientRequestId,
      p_type: params.type,
      p_table_id: params.tableId || null,
      p_customer_name: params.customerName || null,
      p_customer_phone: params.customerPhone || null,
      p_delivery_address: params.deliveryAddress || null,
      p_notes: params.notes || null,
      p_discount: params.discount || 0,
      p_delivery_fee: params.deliveryFee || 0,
      p_items: params.items,
    })
    if (error) throw error
    return data
  }

  // Local fallback persistence for demo/offline
  return simulateLocalCreateOrder(params)
}

export async function settlePayment(params: SettlePaymentParams): Promise<{
  id: string
  order_id: string
  amount: number
  total_paid: number
  order_total: number
  is_fully_paid: boolean
}> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('settle_payment', {
      p_branch_id: params.branchId,
      p_order_id: params.orderId,
      p_method: params.method,
      p_amount: params.amount,
      p_idempotency_key: params.idempotencyKey,
      p_cash_session_id: params.cashSessionId || null,
      p_provider_ref: params.providerRef || null,
    })
    if (error) throw error
    return data
  }

  // Local fallback: attach payment and mark completed/served in Storage
  const paymentId = crypto.randomUUID()
  const orders = Storage.getOrders(params.branchId)
  const order = orders.find((o) => o.id === params.orderId)
  if (order) {
    const payment = {
      id: paymentId,
      branch_id: params.branchId,
      order_id: params.orderId,
      method: params.method,
      status: 'succeeded' as const,
      amount: params.amount,
      idempotency_key: params.idempotencyKey,
      created_at: new Date().toISOString(),
    }
    const updatedOrder: Order = {
      ...order,
      // Preserve active kitchen status so kitchen ticket is never prematurely wiped
      status: (order.status === 'sent_to_kitchen' || order.status === 'preparing' || order.status === 'ready')
        ? order.status
        : (order.status || 'sent_to_kitchen'),
      payments: [...(order.payments || []), payment],
      updated_at: new Date().toISOString(),
    }
    Storage.saveOrder(updatedOrder)
  }

  return {
    id: paymentId,
    order_id: params.orderId,
    amount: params.amount,
    total_paid: params.amount,
    order_total: params.amount,
    is_fully_paid: true,
  }
}

// ---------------------------------------------------------------- Offline Order Queue
export function getOfflineQueue(): CreateOrderParams[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function queueOfflineOrder(params: CreateOrderParams) {
  const queue = getOfflineQueue()
  queue.push(params)
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue()
  if (queue.length === 0 || !isSupabaseConfigured) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining: CreateOrderParams[] = []

  for (const item of queue) {
    try {
      await createOrder(item)
      synced++
    } catch {
      failed++
      remaining.push(item)
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
  return { synced, failed }
}

// ---------------------------------------------------------------- Fallback Demo Data
function simulateLocalCreateOrder(params: CreateOrderParams) {
  const items = Storage.getMenuItems(params.branchId)
  let subtotal = 0
  const orderItems = []
  for (const it of params.items) {
    const mi = items.find((m) => m.id === it.menu_item_id)
    if (mi) {
      const lineTotal = mi.price * it.quantity
      subtotal += lineTotal
      orderItems.push({
        id: crypto.randomUUID(),
        order_id: '',
        branch_id: params.branchId,
        menu_item_id: mi.id,
        item_name: mi.name,
        unit_price: mi.price,
        quantity: it.quantity,
        line_total: lineTotal,
        notes: it.notes || null,
      })
    }
  }
  const dealDiscount = params.dealDiscount || 0
  const manualDiscount = params.discount || 0
  const totalDiscount = dealDiscount + manualDiscount
  const discountedSubtotal = Math.max(0, subtotal - totalDiscount)
  const tax = Math.round(discountedSubtotal * 0.13)
  const delivery = params.deliveryFee || 0
  const total = discountedSubtotal + tax + delivery

  // Link or auto-match customer if phone provided
  let linkedCustomerId = params.customerId || null
  if (params.customerPhone?.trim()) {
    const allCusts = Storage.getCustomers(params.branchId)
    const matched = allCusts.find((c) => c.phone.replace(/[\s-]/g, '') === params.customerPhone!.replace(/[\s-]/g, ''))
    if (matched) {
      linkedCustomerId = matched.id
    } else if (params.customerName?.trim()) {
      const newCust = Storage.saveCustomer(params.branchId, {
        name: params.customerName.trim(),
        phone: params.customerPhone.trim(),
        address: params.deliveryAddress || null,
        marketing_consent: 'unspecified',
        marketing_consent_source: 'pos',
      })
      linkedCustomerId = newCust.id
    }
  }

  // Sequential order number from Storage
  const existingOrders = Storage.getOrders(params.branchId)
  const highestNumber = existingOrders.reduce((max, o) => Math.max(max, o.order_number || 1000), 1000)
  const orderNum = highestNumber + 1

  const orderId = crypto.randomUUID()
  const newOrder: Order = {
    id: orderId,
    branch_id: params.branchId,
    order_number: orderNum,
    business_date: getKarachiBusinessDate(),
    client_request_id: params.clientRequestId,
    type: params.type,
    status: 'sent_to_kitchen',
    table_id: params.tableId || null,
    customer_id: linkedCustomerId,
    customer_name: params.customerName || (params.type === 'dine_in' ? 'Dine-In Guest' : 'Takeaway Customer'),
    customer_phone: params.customerPhone || null,
    delivery_address: params.deliveryAddress || null,
    delivery_fee: delivery,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    subtotal,
    deal_id: params.dealId || null,
    deal_discount: dealDiscount,
    discount: totalDiscount,
    tax,
    total,
    notes: params.notes || null,
    created_by: 'Staff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: orderItems.map((oi) => ({ ...oi, order_id: orderId })),
    payments: [],
  }

  // Persist to unified Storage
  Storage.saveOrder(newOrder)

  // Keep legacy key synced
  try {
    const raw = localStorage.getItem('karachi_pos_local_orders')
    const localList = raw ? JSON.parse(raw) : []
    localList.unshift(newOrder)
    localStorage.setItem('karachi_pos_local_orders', JSON.stringify(localList))
  } catch {
    // ignore
  }

  return {
    id: newOrder.id,
    order_number: orderNum,
    subtotal,
    tax,
    total,
    status: 'sent_to_kitchen',
    is_duplicate_replay: false,
  }
}

export function getLocalStoredOrders(branchId?: string): Order[] {
  return Storage.getOrders(branchId || '635c7b14-54be-4b93-a75a-e2ddc0323827')
}
