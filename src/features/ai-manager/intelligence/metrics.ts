import { roundMoney } from '@/lib/format'
import type { Order, InventoryItem, RecipeItem, MenuItem, Expense, CashSession } from '@/types/domain'

/**
 * Standard estimated ingredient cost benchmark (PKR per unit)
 * Used as reliable fallback when recent PO invoices are not yet entered.
 */
export const INGREDIENT_BENCHMARK_COSTS: Record<string, number> = {
  'inv-1': 240, // Super Kernel Basmati Rice (per kg)
  'inv-2': 380, // Fresh Farm Broiler Chicken (per kg)
  'inv-3': 950, // Prime Boneless Beef (per kg)
  'inv-4': 1600, // Fresh Mutton Meat (per kg)
  'inv-5': 420, // Cooking Oil (per Ltr)
  'inv-6': 120, // Fine Wheat Flour (per kg)
  'inv-7': 190, // Buffalo Whole Milk (per Ltr)
}

export interface SalesMetrics {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  grossSales: number
  totalDiscounts: number
  totalTax: number
  netSales: number
  averageOrderValue: number
  dineInCount: number
  deliveryCount: number
  takeawayCount: number
  cashTotal: number
  cardTotal: number
  onlineTotal: number
}

export function computeSalesMetrics(orders: Order[]): SalesMetrics {
  const active = orders || []
  const nonCancelled = active.filter((o) => o.status !== 'cancelled')
  const completed = active.filter((o) => o.status === 'completed' || o.status === 'served')
  const cancelled = active.filter((o) => o.status === 'cancelled')

  const grossSales = roundMoney(nonCancelled.reduce((acc, o) => acc + (o.subtotal || 0), 0))
  const totalDiscounts = roundMoney(nonCancelled.reduce((acc, o) => acc + (o.discount || 0), 0))
  const totalTax = roundMoney(nonCancelled.reduce((acc, o) => acc + (o.tax || 0), 0))
  const netSales = roundMoney(nonCancelled.reduce((acc, o) => acc + (o.total || 0), 0))

  const averageOrderValue = nonCancelled.length > 0 ? roundMoney(netSales / nonCancelled.length) : 0

  let dineInCount = 0
  let deliveryCount = 0
  let takeawayCount = 0

  nonCancelled.forEach((o) => {
    if (o.type === 'dine_in') dineInCount++
    else if (o.type === 'delivery') deliveryCount++
    else if (o.type === 'takeaway') takeawayCount++
  })

  let cashTotal = 0
  let cardTotal = 0
  let onlineTotal = 0

  nonCancelled.forEach((o) => {
    o.payments?.forEach((p) => {
      if (p.status === 'succeeded' || !p.status) {
        const m = p.method?.toLowerCase()
        if (m === 'cash') cashTotal += p.amount
        else if (m === 'card') cardTotal += p.amount
        else if (m === 'jazzcash' || m === 'easypaisa' || m === 'bank_transfer') onlineTotal += p.amount
      }
    })
  })

  return {
    totalOrders: active.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    grossSales,
    totalDiscounts,
    totalTax,
    netSales,
    averageOrderValue,
    dineInCount,
    deliveryCount,
    takeawayCount,
    cashTotal: roundMoney(cashTotal),
    cardTotal: roundMoney(cardTotal),
    onlineTotal: roundMoney(onlineTotal),
  }
}

/**
 * Robust percentage difference calculation avoiding NaN or Infinity
 */
export function calcPercentageChange(current: number, previous: number): {
  pct: number
  diff: number
  text: string
  direction: 'up' | 'down' | 'flat'
} {
  const diff = roundMoney(current - previous)
  if (previous === 0) {
    if (current === 0) return { pct: 0, diff: 0, text: '0.0%', direction: 'flat' }
    return { pct: 100, diff, text: '+100.0%', direction: 'up' }
  }

  const rawPct = ((current - previous) / previous) * 100
  const pct = Number(rawPct.toFixed(1))

  if (pct > 0) return { pct, diff, text: `+${pct}%`, direction: 'up' }
  if (pct < 0) return { pct, diff, text: `${pct}%`, direction: 'down' }
  return { pct: 0, diff: 0, text: '0.0%', direction: 'flat' }
}

export interface DishProfitabilityMetric {
  menuItemId: string
  name: string
  price: number
  qtySold: number
  totalRevenue: number
  estimatedCost: number
  contributionMargin: number
  marginPct: number
  foodCostPct: number
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
  hasRecipe: boolean
}

/**
 * Calculates item contribution margin using real recipe items & ingredient benchmarks
 */
export function computeMenuProfitability(
  menuItems: MenuItem[],
  orders: Order[],
  recipes: RecipeItem[],
  inventory?: InventoryItem[]
): DishProfitabilityMetric[] {
  void inventory
  const validOrders = orders.filter((o) => o.status !== 'cancelled')

  // Item volume map
  const itemSalesMap: Record<string, { qty: number; revenue: number }> = {}
  validOrders.forEach((o) => {
    o.items?.forEach((it) => {
      const id = it.menu_item_id
      if (!itemSalesMap[id]) itemSalesMap[id] = { qty: 0, revenue: 0 }
      itemSalesMap[id].qty += it.quantity || 1
      itemSalesMap[id].revenue += it.line_total || it.unit_price * (it.quantity || 1)
    })
  })

  // Calculate ingredient costs for each recipe
  const recipeCostMap: Record<string, { cost: number; hasRecipe: boolean }> = {}
  menuItems.forEach((m) => {
    const itemRecipes = recipes.filter((r) => r.menu_item_id === m.id)
    if (itemRecipes.length === 0) {
      // Conservative estimate if recipe not linked: 35% of menu price
      recipeCostMap[m.id] = { cost: roundMoney(m.price * 0.35), hasRecipe: false }
    } else {
      let costSum = 0
      itemRecipes.forEach((r) => {
        const unitCost = INGREDIENT_BENCHMARK_COSTS[r.inventory_item_id] || 250
        costSum += r.quantity * unitCost
      })
      recipeCostMap[m.id] = { cost: roundMoney(costSum), hasRecipe: true }
    }
  })

  // Median thresholds for Menu Engineering Matrix
  const list = menuItems.map((m) => {
    const sales = itemSalesMap[m.id] || { qty: 0, revenue: 0 }
    const costInfo = recipeCostMap[m.id] || { cost: 0, hasRecipe: false }
    const estCost = costInfo.cost
    const margin = roundMoney(Math.max(0, m.price - estCost))
    const marginPct = m.price > 0 ? Number(((margin / m.price) * 100).toFixed(1)) : 0
    const foodCostPct = m.price > 0 ? Number(((estCost / m.price) * 100).toFixed(1)) : 0

    return {
      menuItemId: m.id,
      name: m.name,
      price: m.price,
      qtySold: sales.qty,
      totalRevenue: roundMoney(sales.revenue),
      estimatedCost: estCost,
      contributionMargin: margin,
      marginPct,
      foodCostPct,
      hasRecipe: costInfo.hasRecipe,
      classification: 'Star' as const,
    }
  })

  const avgQty = list.length > 0 ? list.reduce((a, b) => a + b.qtySold, 0) / list.length : 0
  const avgMargin = list.length > 0 ? list.reduce((a, b) => a + b.contributionMargin, 0) / list.length : 0

  return list.map((item) => {
    const highPop = item.qtySold >= avgQty
    const highMargin = item.contributionMargin >= avgMargin

    let classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog' = 'Star'
    if (highPop && highMargin) classification = 'Star'
    else if (highPop && !highMargin) classification = 'Plowhorse'
    else if (!highPop && highMargin) classification = 'Puzzle'
    else classification = 'Dog'

    return { ...item, classification }
  })
}

export interface InventoryRestockItem {
  id: string
  name: string
  unit: string
  currentQty: number
  reorderLevel: number
  deficit: number
  suggestedOrderQty: number
  estimatedUnitCost: number
  estimatedTotalCost: number
  status: 'critical' | 'low' | 'healthy'
}

/**
 * Identifies ingredients below safety stock and calculates purchase recommendations
 */
export function computeInventoryRestock(inventory: InventoryItem[]): InventoryRestockItem[] {
  return (inventory || []).map((item) => {
    const deficit = Math.max(0, item.reorder_level - item.current_qty)
    const isCritical = item.current_qty <= item.reorder_level * 0.5
    const isLow = item.current_qty <= item.reorder_level

    const suggestedOrderQty = isLow
      ? Math.max(item.reorder_level * 2 - item.current_qty, item.reorder_level)
      : 0

    const unitCost = INGREDIENT_BENCHMARK_COSTS[item.id] || 250
    const totalCost = roundMoney(suggestedOrderQty * unitCost)

    let status: 'critical' | 'low' | 'healthy' = 'healthy'
    if (isCritical) status = 'critical'
    else if (isLow) status = 'low'

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentQty: item.current_qty,
      reorderLevel: item.reorder_level,
      deficit: roundMoney(deficit),
      suggestedOrderQty: roundMoney(suggestedOrderQty),
      estimatedUnitCost: unitCost,
      estimatedTotalCost: totalCost,
      status,
    }
  })
}

export interface CashDrawerAnalysis {
  hasOpenSession: boolean
  sessionId?: string
  openingFloat: number
  cashSales: number
  cashPayouts: number
  expectedCash: number
  countedCash?: number
  variance?: number
  isBalanced: boolean
  openedByName?: string
  openedAt?: string
}

export function computeCashDrawerAnalysis(
  activeSession: CashSession | null | undefined,
  orders: Order[],
  expenses: Expense[]
): CashDrawerAnalysis {
  if (!activeSession) {
    return {
      hasOpenSession: false,
      openingFloat: 0,
      cashSales: 0,
      cashPayouts: 0,
      expectedCash: 0,
      isBalanced: true,
    }
  }

  const openingFloat = Number(activeSession.opening_float) || 0

  // Calculate cash sales strictly for this session or day
  const validOrders = orders.filter((o) => o.status !== 'cancelled')
  let cashSales = 0
  validOrders.forEach((o) => {
    o.payments?.forEach((p) => {
      if (p.method?.toLowerCase() === 'cash' && (p.status === 'succeeded' || !p.status)) {
        cashSales += p.amount
      }
    })
  })

  // Calculate cash payouts/expenses
  const sessionExpenses = (expenses || []).filter(
    (e) => e.payment_method === 'cash' && (!e.cash_session_id || e.cash_session_id === activeSession.id)
  )
  const cashPayouts = sessionExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)

  const expectedCash = roundMoney(openingFloat + cashSales - cashPayouts)
  const countedCash = activeSession.counted_cash != null ? Number(activeSession.counted_cash) : undefined
  const variance = countedCash != null ? roundMoney(countedCash - expectedCash) : undefined

  return {
    hasOpenSession: true,
    sessionId: activeSession.id,
    openingFloat: roundMoney(openingFloat),
    cashSales: roundMoney(cashSales),
    cashPayouts: roundMoney(cashPayouts),
    expectedCash,
    countedCash,
    variance,
    isBalanced: variance === undefined || variance === 0,
    openedByName: activeSession.opened_by_profile?.full_name || 'Counter Cashier',
    openedAt: activeSession.opened_at,
  }
}
