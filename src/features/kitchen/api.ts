import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Order } from '@/types/domain'
import { getLocalStoredOrders } from '@/features/pos/api'
import { updateOrderStatus } from '@/features/orders/api'

export { updateOrderStatus }

export async function fetchKitchenTickets(branchId: string): Promise<Order[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), table:dining_tables(*)')
      .eq('branch_id', branchId)
      .in('status', ['open', 'sent_to_kitchen', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (!error && data) return data as Order[]
  }

  // Fallback local orders
  return getLocalStoredOrders(branchId)
    .filter((o) => o.branch_id === branchId && ['open', 'sent_to_kitchen', 'preparing', 'ready'].includes(o.status))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export function subscribeToKitchenUpdates(branchId: string, onUpdate: () => void) {
  if (!isSupabaseConfigured) return () => {}

  const channel = supabase
    .channel(`kitchen-${branchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
      () => {
        onUpdate()
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_items', filter: `branch_id=eq.${branchId}` },
      () => {
        onUpdate()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
