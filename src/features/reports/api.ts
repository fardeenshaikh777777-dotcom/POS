import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Order } from '@/types/domain'

export interface SalesReportData {
  grossSales: number
  discounts: number
  taxCollected: number
  netSales: number
  totalExpenses: number
  netProfit: number
  orderCount: number
  avgTicket: number
  paymentsBreakdown: Record<string, number>
  typeBreakdown: Record<string, number>
  topDishes: Array<{ name: string; quantity: number; revenue: number }>
  dailyTrend: Array<{ date: string; sales: number; orders: number }>
}

function computeReportFromOrders(orders: Order[], startDate: string, endDate: string, branchId?: string): SalesReportData {
  const filtered = orders.filter((o) => {
    const oDate = o.business_date || (o.created_at ? o.created_at.slice(0, 10) : '')
    return oDate >= startDate && oDate <= endDate
  })

  const nonCancelled = filtered.filter((o) => o.status !== 'cancelled')
  const grossSales = nonCancelled.reduce((acc, o) => acc + (o.subtotal || 0), 0)
  const discounts = nonCancelled.reduce((acc, o) => acc + (o.discount || 0), 0)
  const taxCollected = nonCancelled.reduce((acc, o) => acc + (o.tax || 0), 0)
  const netSales = nonCancelled.reduce((acc, o) => acc + (o.total || 0), 0)
  const orderCount = filtered.length
  const avgTicket = nonCancelled.length > 0 ? Math.round(netSales / nonCancelled.length) : 0

  // Payment Breakdown strictly from actual payment records
  const paymentsBreakdown: Record<string, number> = {
    cash: 0,
    card: 0,
    jazzcash: 0,
    easypaisa: 0,
  }

  nonCancelled.forEach((o) => {
    if (Array.isArray(o.payments) && o.payments.length > 0) {
      o.payments.forEach((p) => {
        const m = (p.method || 'cash').toLowerCase()
        if (m in paymentsBreakdown) {
          paymentsBreakdown[m] += p.amount || 0
        } else {
          paymentsBreakdown[m] = p.amount || 0
        }
      })
    } else {
      // Unrecorded payments on non-cancelled orders fallback to cash attribution
      paymentsBreakdown.cash += o.total || 0
    }
  })

  // Order Type Breakdown
  const typeBreakdown: Record<string, number> = {
    dine_in: 0,
    takeaway: 0,
    delivery: 0,
  }

  filtered.forEach((o) => {
    const tp = o.type || 'dine_in'
    if (tp in typeBreakdown) {
      typeBreakdown[tp] += 1
    } else {
      typeBreakdown[tp] = 1
    }
  })

  // Top Dishes aggregated from actual order line items
  const itemMap: Record<string, { quantity: number; revenue: number }> = {}
  nonCancelled.forEach((o) => {
    if (Array.isArray(o.items)) {
      o.items.forEach((it) => {
        const name = it.item_name || 'Menu Dish'
        if (!itemMap[name]) {
          itemMap[name] = { quantity: 0, revenue: 0 }
        }
        itemMap[name].quantity += it.quantity || 1
        itemMap[name].revenue += it.line_total || ((it.unit_price || 0) * (it.quantity || 1))
      })
    }
  })

  const topDishes = Object.entries(itemMap)
    .map(([name, stat]) => ({ name, quantity: stat.quantity, revenue: stat.revenue }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

  // Daily Trend by date
  const trendMap: Record<string, { sales: number; orders: number }> = {}
  filtered.forEach((o) => {
    const d = o.business_date || (o.created_at ? o.created_at.slice(0, 10) : startDate)
    if (!trendMap[d]) {
      trendMap[d] = { sales: 0, orders: 0 }
    }
    trendMap[d].orders += 1
    if (o.status !== 'cancelled') {
      trendMap[d].sales += o.total || 0
    }
  })

  const dailyTrend = Object.entries(trendMap)
    .sort(([dA], [dB]) => dA.localeCompare(dB))
    .map(([date, stat]) => ({ date, sales: stat.sales, orders: stat.orders }))

  // Calculate operational expenses for the period
  const expenses = branchId ? Storage.getExpenses(branchId) : Storage.getExpenses('635c7b14-54be-4b93-a75a-e2ddc0323827')
  const filteredExpenses = expenses.filter((e) => {
    const eDate = e.created_at ? e.created_at.slice(0, 10) : ''
    return eDate >= startDate && eDate <= endDate
  })
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)
  const netProfit = netSales - totalExpenses

  return {
    grossSales,
    discounts,
    taxCollected,
    netSales,
    totalExpenses,
    netProfit,
    orderCount,
    avgTicket,
    paymentsBreakdown,
    typeBreakdown,
    topDishes,
    dailyTrend,
  }
}

export async function fetchSalesReport(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<SalesReportData> {
  if (isSupabaseConfigured) {
    try {
      const { data: dbOrders, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*), payments(*)')
        .eq('branch_id', branchId)
        .gte('business_date', startDate)
        .lte('business_date', endDate)

      if (!error && dbOrders && dbOrders.length > 0) {
        return computeReportFromOrders(dbOrders as Order[], startDate, endDate, branchId)
      }

      // Try RPC fallback if direct table query was empty
      const { data: metrics } = await supabase.rpc('get_owner_dashboard_metrics', {
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (metrics && metrics.total_orders > 0) {
        const net = metrics.net_sales || 0
        const exp = metrics.total_expenses || 0
        return {
          grossSales: metrics.gross_sales,
          discounts: metrics.total_discounts,
          taxCollected: metrics.total_tax,
          netSales: net,
          totalExpenses: exp,
          netProfit: net - exp,
          orderCount: metrics.total_orders,
          avgTicket: metrics.average_order_value,
          paymentsBreakdown: metrics.payments_by_method || {},
          typeBreakdown: metrics.orders_by_type || {},
          topDishes: (metrics.top_items || []).map((it: { item_name: string; qty_sold: number; revenue: number }) => ({
            name: it.item_name,
            quantity: it.qty_sold,
            revenue: it.revenue,
          })),
          dailyTrend: [
            { date: startDate, sales: metrics.net_sales, orders: metrics.total_orders },
          ],
        }
      }
    } catch (err) {
      console.warn('Supabase fetchSalesReport error, falling back to local Storage:', err)
    }
  }

  // Compute live, audited metrics directly from real orders in Storage
  const orders = Storage.getOrders(branchId)
  return computeReportFromOrders(orders, startDate, endDate, branchId)
}
