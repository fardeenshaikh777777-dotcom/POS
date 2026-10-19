import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Order, OrderStatus, OrderType, RiderStatus } from '@/types/domain'

export interface OrderFilter {
  status?: OrderStatus | 'all'
  type?: OrderType | 'all'
  date?: string
  search?: string
}

export async function fetchOrders(branchId: string, filter: OrderFilter = {}): Promise<Order[]> {
  if (isSupabaseConfigured) {
    let q = supabase
      .from('orders')
      .select('*, items:order_items(*), payments(*), table:dining_tables(*)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (filter.status && filter.status !== 'all') {
      q = q.eq('status', filter.status)
    }
    if (filter.type && filter.type !== 'all') {
      q = q.eq('type', filter.type)
    }
    if (filter.date) {
      q = q.eq('business_date', filter.date)
    }
    if (filter.search?.trim()) {
      const s = filter.search.trim()
      q = q.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`)
    }

    const { data, error } = await q
    if (!error && data) return data as Order[]
  }

  // Fallback to local storage orders
  let orders = Storage.getOrders(branchId)
  if (filter.status && filter.status !== 'all') {
    orders = orders.filter((o) => o.status === filter.status)
  }
  if (filter.type && filter.type !== 'all') {
    orders = orders.filter((o) => o.type === filter.type)
  }
  if (filter.search?.trim()) {
    const s = filter.search.trim().toLowerCase().replace(/^#/, '')
    orders = orders.filter(
      (o) =>
        o.order_number.toString().includes(s) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(s)) ||
        (o.customer_phone && o.customer_phone.includes(s)) ||
        (o.rider_name && o.rider_name.toLowerCase().includes(s))
    )
  }
  return orders
}

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus, notes?: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_notes: notes || null,
      })
      if (error) {
        console.warn('Supabase update_order_status RPC failed, falling back to local Storage:', error)
      }
    } catch (err) {
      console.warn('Supabase RPC network error:', err)
    }
  }

  // Always update unified Storage
  const orders = Storage.getOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx !== -1) {
    const updatedOrder: Order = {
      ...orders[idx],
      status: newStatus,
      notes: notes !== undefined ? notes : orders[idx].notes,
      updated_at: new Date().toISOString(),
    }
    Storage.saveOrder(updatedOrder)

    // Synchronize dining table status
    if (updatedOrder.type === 'dine_in') {
      const tableId = updatedOrder.table_id || updatedOrder.table?.id
      if (tableId) {
        if (newStatus === 'completed' || newStatus === 'cancelled') {
          Storage.updateTableStatus(tableId, null, null)
        } else if (newStatus === 'served' || newStatus === 'preparing' || newStatus === 'ready') {
          Storage.updateTableStatus(tableId, updatedOrder.id, newStatus)
        }
      }
    }
  }

  // Keep legacy storage key synced if present
  try {
    const raw = localStorage.getItem('karachi_pos_local_orders')
    if (raw) {
      const localList = JSON.parse(raw) as Order[]
      const lIdx = localList.findIndex((o) => o.id === orderId)
      if (lIdx !== -1) {
        localList[lIdx].status = newStatus
        localList[lIdx].updated_at = new Date().toISOString()
        localStorage.setItem('karachi_pos_local_orders', JSON.stringify(localList))
      }
    }
  } catch {
    // ignore
  }
}

export async function assignRider(
  orderId: string,
  riderName: string,
  riderPhone: string,
  riderStatus: RiderStatus = 'out_for_delivery'
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          rider_name: riderName,
          rider_phone: riderPhone,
          rider_status: riderStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
      if (error) {
        console.warn('Supabase assignRider error:', error)
      }
    } catch (err) {
      console.warn('Supabase assignRider network error:', err)
    }
  }

  const orders = Storage.getOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx !== -1) {
    const updatedOrder: Order = {
      ...orders[idx],
      rider_name: riderName,
      rider_phone: riderPhone,
      rider_status: riderStatus,
      updated_at: new Date().toISOString(),
    }
    Storage.saveOrder(updatedOrder)
  }

  try {
    const raw = localStorage.getItem('karachi_pos_local_orders')
    if (raw) {
      const localList = JSON.parse(raw) as Order[]
      const lIdx = localList.findIndex((o) => o.id === orderId)
      if (lIdx !== -1) {
        localList[lIdx].rider_name = riderName
        localList[lIdx].rider_phone = riderPhone
        localList[lIdx].rider_status = riderStatus
        localList[lIdx].updated_at = new Date().toISOString()
        localStorage.setItem('karachi_pos_local_orders', JSON.stringify(localList))
      }
    }
  } catch {
    // ignore
  }
}
