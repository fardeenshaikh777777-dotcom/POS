import { describe, expect, it } from 'vitest'
import { normalizeQuery, getDefaultPeriod } from './normalizer'
import { matchIntent } from './intentRegistry'
import {
  computeSalesMetrics,
  calcPercentageChange,
  computeMenuProfitability,
  computeInventoryRestock,
  computeCashDrawerAnalysis,
} from './metrics'
import { executeIntelligenceQuery, isIntentPermittedForRole } from './intelligenceEngine'
import type { OperationalContext } from './types'
import type { Order, InventoryItem, MenuItem, RecipeItem, CashSession } from '@/types/domain'

const MOCK_BRANCH = '635c7b14-54be-4b93-a75a-e2ddc0323827'

const sampleOrders: Order[] = [
  {
    id: 'o-1',
    branch_id: MOCK_BRANCH,
    order_number: 101,
    business_date: '2026-10-18',
    client_request_id: 'cr-1',
    type: 'dine_in',
    status: 'completed',
    subtotal: 1000,
    discount: 100,
    tax: 117,
    total: 1017,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-1',
    created_at: '2026-10-18T13:00:00Z',
    updated_at: '2026-10-18T13:30:00Z',
    items: [
      { id: 'i-1', order_id: 'o-1', branch_id: MOCK_BRANCH, menu_item_id: 'm-1', item_name: 'Chicken Biryani', unit_price: 500, quantity: 2, line_total: 1000 },
    ],
    payments: [
      { id: 'p-1', branch_id: MOCK_BRANCH, order_id: 'o-1', method: 'cash', status: 'succeeded', amount: 1017, idempotency_key: 'ik-1', created_at: '2026-10-18T13:05:00Z' },
    ],
  },
  {
    id: 'o-2',
    branch_id: MOCK_BRANCH,
    order_number: 102,
    business_date: '2026-10-18',
    client_request_id: 'cr-2',
    type: 'takeaway',
    status: 'cancelled', // Cancelled order should be excluded from net sales and AOV
    subtotal: 2000,
    discount: 0,
    tax: 260,
    total: 2260,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-1',
    created_at: '2026-10-18T14:00:00Z',
    updated_at: '2026-10-18T14:05:00Z',
    items: [
      { id: 'i-2', order_id: 'o-2', branch_id: MOCK_BRANCH, menu_item_id: 'm-2', item_name: 'Mutton Karahi', unit_price: 2000, quantity: 1, line_total: 2000 },
    ],
    payments: [],
  },
]

const sampleInventory: InventoryItem[] = [
  { id: 'inv-1', branch_id: MOCK_BRANCH, name: 'Basmati Rice', unit: 'kg', current_qty: 10, reorder_level: 25, is_active: true, created_at: '' },
  { id: 'inv-2', branch_id: MOCK_BRANCH, name: 'Chicken Meat', unit: 'kg', current_qty: 30, reorder_level: 15, is_active: true, created_at: '' },
]

const sampleMenu: MenuItem[] = [
  { id: 'm-1', branch_id: MOCK_BRANCH, category_id: 'c-1', name: 'Chicken Biryani', price: 500, is_available: true },
  { id: 'm-2', branch_id: MOCK_BRANCH, category_id: 'c-1', name: 'Mutton Karahi', price: 2000, is_available: true },
]

const sampleRecipes: RecipeItem[] = [
  { id: 'r-1', branch_id: MOCK_BRANCH, menu_item_id: 'm-1', inventory_item_id: 'inv-1', quantity: 0.25, unit: 'kg' },
]

function buildMockContext(overrides?: Partial<OperationalContext>): OperationalContext {
  const { period, comparisonPeriod } = getDefaultPeriod('today')
  return {
    branchId: MOCK_BRANCH,
    branchName: 'Test Branch',
    userRole: 'owner',
    period,
    comparisonPeriod,
    orders: sampleOrders,
    comparisonOrders: [],
    inventory: sampleInventory,
    menuItems: sampleMenu,
    categories: [],
    recipes: sampleRecipes,
    expenses: [],
    comparisonExpenses: [],
    tables: [],
    reservations: [],
    customers: [],
    purchaseOrders: [],
    activeCashSession: null,
    ...overrides,
  }
}

describe('AI Restaurant Manager: Normalizer & Date Extraction', () => {
  it('extracts date tokens and normalizes text properly', () => {
    const q1 = normalizeQuery("Why are sales lower yesterday compared to today?")
    expect(q1.tokens).toContain('sales')
    expect(q1.tokens).toContain('yesterday')
    expect(q1.detectedPeriod?.label).toBe('Yesterday')

    const q2 = normalizeQuery("Show me low stock items this week!")
    expect(q2.detectedPeriod?.label).toBe('Last 7 Days')
    expect(q2.tokens).toContain('low')
    expect(q2.tokens).toContain('stock')
  })

  it('handles empty and punctuation strings cleanly', () => {
    const q = normalizeQuery("   ??? !!!   ")
    expect(q.normalized).toBe('')
    expect(q.tokens.length).toBe(0)
  })
})

describe('AI Restaurant Manager: Intent Matching', () => {
  it('accurately classifies supported natural language questions', () => {
    expect(matchIntent(normalizeQuery("Why did sales drop today?")).intent).toBe('sales_comparison')
    expect(matchIntent(normalizeQuery("Which dishes sold the most?")).intent).toBe('best_selling_dishes')
    expect(matchIntent(normalizeQuery("What dishes have the highest contribution margin?")).intent).toBe('menu_profitability')
    expect(matchIntent(normalizeQuery("Which ingredients are below reorder level?")).intent).toBe('low_stock_alerts')
    expect(matchIntent(normalizeQuery("What items should we reorder from suppliers?")).intent).toBe('purchase_recommendations')
    expect(matchIntent(normalizeQuery("Is there any difference or shortage in cash drawer?")).intent).toBe('cash_discrepancy')
    expect(matchIntent(normalizeQuery("Show expense report for utilities")).intent).toBe('expense_analysis')
    expect(matchIntent(normalizeQuery("Are there slow orders or kitchen delays?")).intent).toBe('operations_kitchen')
    expect(matchIntent(normalizeQuery("What is table occupancy right now?")).intent).toBe('table_occupancy')
  })

  it('gracefully marks unsupported or random questions', () => {
    expect(matchIntent(normalizeQuery("what is the weather in London")).intent).toBe('unsupported')
    expect(matchIntent(normalizeQuery("tell me a joke")).intent).toBe('unsupported')
    expect(matchIntent(normalizeQuery("")).intent).toBe('unsupported')
  })
})

describe('AI Restaurant Manager: Financial & Metric Calculations', () => {
  it('computes sales metrics excluding cancellations', () => {
    const metrics = computeSalesMetrics(sampleOrders)
    expect(metrics.totalOrders).toBe(2)
    expect(metrics.cancelledOrders).toBe(1)
    expect(metrics.completedOrders).toBe(1)
    // Non-cancelled order total is 1017, gross is 1000, discount is 100, tax is 117
    expect(metrics.netSales).toBe(1017)
    expect(metrics.grossSales).toBe(1000)
    expect(metrics.totalDiscounts).toBe(100)
    expect(metrics.averageOrderValue).toBe(1017)
    expect(metrics.cashTotal).toBe(1017)
  })

  it('handles zero orders and empty datasets safely without division by zero', () => {
    const metrics = computeSalesMetrics([])
    expect(metrics.totalOrders).toBe(0)
    expect(metrics.netSales).toBe(0)
    expect(metrics.averageOrderValue).toBe(0)
    expect(metrics.totalDiscounts).toBe(0)

    const pct = calcPercentageChange(0, 0)
    expect(pct.pct).toBe(0)
    expect(pct.text).toBe('0.0%')
    expect(pct.direction).toBe('flat')
  })

  it('calculates percentage changes correctly with zero and non-zero baselines', () => {
    const fromZero = calcPercentageChange(500, 0)
    expect(fromZero.pct).toBe(100)
    expect(fromZero.text).toBe('+100.0%')
    expect(fromZero.direction).toBe('up')

    const increase = calcPercentageChange(150, 100)
    expect(increase.pct).toBe(50)
    expect(increase.text).toBe('+50%')

    const drop = calcPercentageChange(75, 100)
    expect(drop.pct).toBe(-25)
    expect(drop.text).toBe('-25%')
    expect(drop.direction).toBe('down')
  })

  it('computes menu contribution margins and classifications accurately', () => {
    const analysis = computeMenuProfitability(sampleMenu, sampleOrders, sampleRecipes, sampleInventory)
    expect(analysis.length).toBe(2)

    const biryani = analysis.find((a) => a.name === 'Chicken Biryani')!
    expect(biryani).toBeDefined()
    expect(biryani.price).toBe(500)
    // 0.25 kg rice * 240 benchmark = Rs. 60 cost
    expect(biryani.estimatedCost).toBe(60)
    expect(biryani.contributionMargin).toBe(440)
    expect(biryani.marginPct).toBe(88) // 440 / 500 = 88%
    expect(biryani.qtySold).toBe(2)
  })

  it('identifies low stock items and calculates reorder recommendations', () => {
    const restock = computeInventoryRestock(sampleInventory)
    const lowItem = restock.find((i) => i.id === 'inv-1')!
    expect(lowItem.status).toBe('critical') // 10 <= 25 * 0.5 (12.5) -> critical
    expect(lowItem.deficit).toBe(15) // 25 - 10
    // Suggested: 25 * 2 - 10 = 40
    expect(lowItem.suggestedOrderQty).toBe(40)
    expect(lowItem.estimatedTotalCost).toBe(40 * 240) // 9600

    const healthyItem = restock.find((i) => i.id === 'inv-2')!
    expect(healthyItem.status).toBe('healthy')
    expect(healthyItem.suggestedOrderQty).toBe(0)
  })

  it('calculates cash drawer balance, variance, and shortage without accusation', () => {
    const mockSession: CashSession = {
      id: 'sess-1',
      branch_id: MOCK_BRANCH,
      opened_by: 'usr-1',
      opened_at: '2026-10-18T10:00:00Z',
      opening_float: 5000,
      counted_cash: 5800, // Shortage of 217 (Expected: 5000 + 1017 = 6017)
    }

    const res = computeCashDrawerAnalysis(mockSession, sampleOrders, [])
    expect(res.hasOpenSession).toBe(true)
    expect(res.openingFloat).toBe(5000)
    expect(res.cashSales).toBe(1017)
    expect(res.expectedCash).toBe(6017)
    expect(res.countedCash).toBe(5800)
    expect(res.variance).toBe(-217)
    expect(res.isBalanced).toBe(false)
  })
})

describe('AI Restaurant Manager: Role Security & Isolation', () => {
  it('enforces least-privilege role boundaries', () => {
    // Owner can access all
    expect(isIntentPermittedForRole('sales_comparison', 'owner')).toBe(true)
    expect(isIntentPermittedForRole('menu_profitability', 'owner')).toBe(true)

    // Waiter cannot access financial sales comparisons or menu profit margins
    expect(isIntentPermittedForRole('sales_comparison', 'waiter')).toBe(false)
    expect(isIntentPermittedForRole('menu_profitability', 'waiter')).toBe(false)
    // Waiter can access floor table occupancy
    expect(isIntentPermittedForRole('table_occupancy', 'waiter')).toBe(true)

    // Kitchen cannot access cash drawer
    expect(isIntentPermittedForRole('cash_discrepancy', 'kitchen')).toBe(false)
    // Kitchen can access low stock and kitchen operations
    expect(isIntentPermittedForRole('low_stock_alerts', 'kitchen')).toBe(true)
  })

  it('returns role restriction notice when unauthorized role queries restricted metrics', () => {
    const waiterContext = buildMockContext({ userRole: 'waiter' })
    const res = executeIntelligenceQuery("What are our highest profit margin dishes?", waiterContext)
    expect(res.intent).toBe('unsupported')
    expect(res.title).toContain('Restricted Operational Metric')
    expect(res.answer).toContain('restricted to Management & Owners')
  })

  it('owner query returns full evidence, math formula, and recommendations', () => {
    const ownerContext = buildMockContext({ userRole: 'owner' })
    const res = executeIntelligenceQuery("Why did sales drop today?", ownerContext)
    expect(res.intent).toBe('sales_comparison')
    expect(res.metrics.length).toBeGreaterThan(0)
    expect(res.evidence.length).toBeGreaterThan(0)
    expect(res.reason).toContain('SUM(order.total)')
    expect(res.recommendations.length).toBeGreaterThan(0)
    expect(res.recommendations[0].targetRoute).toBeDefined()
  })
})
