import { formatPKR } from '@/lib/format'
import type { OperationalContext, AiAnalysisResult } from '../types'

export function analyzeBestSellingDishes(context: OperationalContext): AiAnalysisResult {
  const validOrders = (context.orders || []).filter((o) => o.status !== 'cancelled')

  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  validOrders.forEach((o) => {
    o.items?.forEach((it: { item_name: string; quantity?: number; line_total?: number; unit_price: number }) => {
      const key = it.item_name
      if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
      itemMap[key].qty += it.quantity || 1
      itemMap[key].revenue += it.line_total || it.unit_price * (it.quantity || 1)
    })
  })

  const sorted = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
  const top = sorted[0]
  const totalItemsSold = sorted.reduce((a, b) => a + b.qty, 0)

  const answer = top
    ? `The #1 best-selling dish for ${context.period.label} is "${top.name}" with ${top.qty} portions sold, generating ${formatPKR(top.revenue)} in revenue. Across all categories, ${totalItemsSold} total portions were served across ${validOrders.length} orders.`
    : `No dish sales have been recorded for ${context.period.label}.`

  return {
    intent: 'best_selling_dishes',
    title: `Best-Selling Dishes & Sales Mix (${context.period.label})`,
    summary: top
      ? `Top dish: ${top.name} (${top.qty} sold, ${formatPKR(top.revenue)}). Total volume: ${totalItemsSold} units.`
      : 'No dish sales observed in this period.',
    answer,
    metrics: [
      {
        label: 'Top Volume Dish',
        value: top ? top.name : 'N/A',
        tone: 'accent',
        helper: top ? `${top.qty} servings sold` : undefined,
      },
      {
        label: 'Top Dish Revenue',
        value: top ? formatPKR(top.revenue) : 'Rs. 0',
        tone: 'ok',
        helper: top && totalItemsSold > 0 ? `${((top.qty / totalItemsSold) * 100).toFixed(1)}% of all portions` : undefined,
      },
      {
        label: 'Total Portions Served',
        value: totalItemsSold,
        tone: 'neutral',
        helper: `Across ${sorted.length} unique menu items`,
      },
    ],
    evidence: sorted.slice(0, 6).map((item, idx) => ({
      title: `#${idx + 1} ${item.name}`,
      detail: `Quantity Sold: ${item.qty} units | Total Line Revenue: ${formatPKR(item.revenue)}`,
      figure: `${item.qty} units`,
    })),
    reason: 'Aggregated directly from line items on non-cancelled orders: Qty = SUM(order_items.quantity); Revenue = SUM(order_items.line_total). Sorted in descending order of volume.',
    recommendations: [
      {
        actionText: 'Review Menu Item Availability & Stock',
        explanation: 'Ensure raw ingredients for top-selling items are sufficiently stocked for the upcoming service.',
        targetRoute: '/inventory',
        routeLabel: 'Open Inventory',
        priority: 'high',
      },
      {
        actionText: 'Inspect Order Line Mix in Reports',
        explanation: 'Check detailed item popularity reports and category distributions.',
        targetRoute: '/reports',
        routeLabel: 'Open Reports',
        priority: 'medium',
      },
    ],
    confidence: sorted.length > 0 ? 'high' : 'medium',
    limitations: ['Excludes cancelled orders and voided lines.'],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: totalItemsSold,
      reliability: 'complete',
    },
    generatedAt: new Date().toISOString(),
  }
}

export function analyzeKitchenOperations(context: OperationalContext): AiAnalysisResult {
  const orders = context.orders || []
  const activeTickets = orders.filter(
    (o) => o.status === 'open' || o.status === 'sent_to_kitchen' || o.status === 'preparing'
  )
  const readyTickets = orders.filter((o) => o.status === 'ready')

  // Peak Hour calculation from actual timestamps
  const hourHistogram: Record<number, number> = {}
  orders.forEach((o) => {
    if (o.created_at) {
      const h = new Date(o.created_at).getHours()
      hourHistogram[h] = (hourHistogram[h] || 0) + 1
    }
  })

  let peakHour = 'N/A'
  let maxCount = 0
  Object.entries(hourHistogram).forEach(([h, count]) => {
    if (count > maxCount) {
      maxCount = count
      const numH = Number(h)
      const period = numH >= 12 ? 'PM' : 'AM'
      const displayH = numH % 12 === 0 ? 12 : numH % 12
      peakHour = `${displayH}:00 ${period} (${count} orders)`
    }
  })

  const answer = activeTickets.length > 0
    ? `The kitchen currently has ${activeTickets.length} active ticket${activeTickets.length > 1 ? 's' : ''} in preparation and ${readyTickets.length} order${readyTickets.length > 1 ? 's' : ''} ready for counter pickup or table service. Peak service demand occurred at ${peakHour}.`
    : `The kitchen currently has 0 tickets pending preparation. All active orders are served or completed. Peak service volume occurred at ${peakHour}.`

  return {
    intent: 'operations_kitchen',
    title: `Kitchen Operations & Order Fulfillment (${context.period.label})`,
    summary: `Active tickets: ${activeTickets.length} in prep, ${readyTickets.length} ready. Peak service: ${peakHour}.`,
    answer,
    metrics: [
      {
        label: 'Active Kitchen Tickets',
        value: activeTickets.length,
        tone: activeTickets.length > 5 ? 'warn' : 'ok',
        helper: 'Currently preparing on KDS',
      },
      {
        label: 'Ready for Service',
        value: readyTickets.length,
        tone: readyTickets.length > 0 ? 'accent' : 'neutral',
        helper: 'Awaiting waiter/rider pickup',
      },
      {
        label: 'Peak Service Hour',
        value: peakHour,
        tone: 'neutral',
        helper: 'Highest concurrent orders',
      },
    ],
    evidence: [
      {
        title: 'Active Tickets in Kitchen',
        detail: activeTickets.length > 0
          ? activeTickets.map((t) => `#ORD-${t.order_number} (${t.type})`).join(', ')
          : 'Kitchen queue is currently clear.',
      },
      {
        title: 'Peak Demand Window',
        detail: `The busiest ordering interval recorded was ${peakHour} based on created_at order timestamps.`,
      },
    ],
    reason: 'Analyzed directly from active order statuses (open, sent_to_kitchen, preparing, ready) and created_at timestamps.',
    recommendations: [
      {
        actionText: 'Monitor Kitchen Display System (KDS)',
        explanation: 'View real-time ticket statuses and bump completed dishes on the kitchen screen.',
        targetRoute: '/kitchen',
        routeLabel: 'Open Kitchen KDS',
        priority: 'high',
      },
      {
        actionText: 'Check Live Order Queue',
        explanation: 'Inspect active tickets, rider dispatch, and customer counter queues.',
        targetRoute: '/orders',
        routeLabel: 'Open Orders',
        priority: 'medium',
      },
    ],
    confidence: orders.length > 0 ? 'high' : 'medium',
    limitations: ['Prep times reflect status transitions recorded in the database.'],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: orders.length,
      reliability: 'complete',
    },
    generatedAt: new Date().toISOString(),
  }
}

export function analyzeTableOccupancy(context: OperationalContext): AiAnalysisResult {
  const tables = context.tables || []
  const occupied = tables.filter((t) => Boolean(t.current_order_id))
  const reservations = context.reservations || []
  const todayReservations = reservations.filter((r) => r.status === 'confirmed')

  const occupancyPct = tables.length > 0 ? Math.round((occupied.length / tables.length) * 100) : 0

  const answer = `Dining floor occupancy is currently at ${occupancyPct}% (${occupied.length} of ${tables.length} tables active). There ${todayReservations.length === 1 ? 'is' : 'are'} ${todayReservations.length} upcoming table reservation${todayReservations.length === 1 ? '' : 's'} scheduled for today.`

  return {
    intent: 'table_occupancy',
    title: 'Dining Floor Occupancy & Table Bookings',
    summary: `Occupancy: ${occupancyPct}% (${occupied.length}/${tables.length} tables). ${todayReservations.length} confirmed reservations.`,
    answer,
    metrics: [
      {
        label: 'Floor Occupancy',
        value: `${occupancyPct}%`,
        tone: occupancyPct > 80 ? 'warn' : 'ok',
        helper: `${occupied.length} seated / ${tables.length - occupied.length} available`,
      },
      {
        label: 'Seated Tables',
        value: occupied.length,
        tone: 'accent',
        helper: occupied.map((t) => t.label).join(', ') || 'None',
      },
      {
        label: 'Upcoming Reservations',
        value: todayReservations.length,
        tone: todayReservations.length > 0 ? 'ok' : 'neutral',
        helper: 'Confirmed bookings today',
      },
    ],
    evidence: [
      {
        title: 'Floor Capacity Breakdown',
        detail: `Total tables: ${tables.length} | Occupied: ${occupied.length} | Open: ${tables.length - occupied.length}`,
      },
      {
        title: 'Upcoming Bookings',
        detail: todayReservations.length > 0
          ? todayReservations.map((r) => `${r.customer_name} (${r.guest_count} guests at ${new Date(r.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`).join('; ')
          : 'No upcoming reservations scheduled for today.',
      },
    ],
    reason: 'Evaluates current dining table status where current_order_id is assigned, cross-referenced with table_reservations for the business date.',
    recommendations: [
      {
        actionText: 'Manage Floor Layout & Reservations',
        explanation: 'View dining floor grid, assign tables to walk-ins, and record guest bookings.',
        targetRoute: '/tables',
        routeLabel: 'Open Tables & Booking',
        priority: 'high',
      },
      {
        actionText: 'Create Dine-In Table Order',
        explanation: 'Open new order for an available dining table from the POS counter.',
        targetRoute: '/pos',
        routeLabel: 'Open POS',
        priority: 'medium',
      },
    ],
    confidence: tables.length > 0 ? 'high' : 'limited_data',
    limitations: ['Occupancy reflects live table assignments in the dining layout.'],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: tables.length,
      reliability: 'complete',
    },
    generatedAt: new Date().toISOString(),
  }
}

export function analyzeCustomerLoyalty(context: OperationalContext): AiAnalysisResult {
  const customers = context.customers || []
  const sortedBySpend = [...customers].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
  const topCustomer = sortedBySpend[0]

  const totalSpentAll = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0)
  const totalOrdersAll = customers.reduce((acc, c) => acc + (c.total_orders || 0), 0)

  const answer = topCustomer
    ? `The customer directory lists ${customers.length} registered profiles with ${totalOrdersAll} lifetime orders and ${formatPKR(totalSpentAll)} in cumulative sales. The highest lifetime spender is "${topCustomer.name}" with ${topCustomer.total_orders} orders totaling ${formatPKR(topCustomer.total_spent)}.`
    : 'No customer profiles are currently registered in this outlet.'

  return {
    intent: 'customer_loyalty',
    title: 'Customer Directory & Order Histories',
    summary: topCustomer
      ? `Top guest: ${topCustomer.name} (${formatPKR(topCustomer.total_spent)}, ${topCustomer.total_orders} orders). Total guests: ${customers.length}.`
      : 'Customer directory is currently empty.',
    answer,
    metrics: [
      {
        label: 'Top Lifetime Spender',
        value: topCustomer ? topCustomer.name : 'N/A',
        tone: 'accent',
        helper: topCustomer ? `${formatPKR(topCustomer.total_spent)} (${topCustomer.total_orders} orders)` : undefined,
      },
      {
        label: 'Registered Customers',
        value: customers.length,
        tone: 'ok',
        helper: 'Verified directory profiles',
      },
      {
        label: 'Cumulative Customer Sales',
        value: formatPKR(totalSpentAll),
        tone: 'neutral',
        helper: `Across ${totalOrdersAll} recorded bills`,
      },
    ],
    evidence: sortedBySpend.slice(0, 5).map((c) => ({
      title: `${c.name} (${c.phone})`,
      detail: `Total Orders: ${c.total_orders} | Total Spent: ${formatPKR(c.total_spent)}${c.notes ? ` | Notes: "${c.notes}"` : ''}`,
      figure: formatPKR(c.total_spent),
    })),
    reason: 'Aggregates verified customer profile histories: Total Lifetime Orders = customers.total_orders; Total Spend = customers.total_spent.',
    recommendations: [
      {
        actionText: 'Review Customer Profiles & Delivery Addresses',
        explanation: 'Inspect frequent guest contact details, delivery addresses, and dietary notes.',
        targetRoute: '/customers',
        routeLabel: 'Open Customers',
        priority: 'high',
      },
    ],
    confidence: customers.length > 0 ? 'high' : 'medium',
    limitations: ['Aggregated strictly from registered customer records without exposing private personal data.'],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: customers.length,
      reliability: 'complete',
    },
    generatedAt: new Date().toISOString(),
  }
}
