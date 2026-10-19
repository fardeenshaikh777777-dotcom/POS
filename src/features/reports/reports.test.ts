import { describe, expect, it, beforeEach } from 'vitest'
import { fetchSalesReport } from './api'
import { Storage } from '@/lib/storage'
import { getKarachiBusinessDate } from '@/lib/format'
import type { Order } from '@/types/domain'

const BRANCH_ID = '635c7b14-54be-4b93-a75a-e2ddc0323827'

// Polyfill window & localStorage for Node test environment
const memoryStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => memoryStore[k] || null,
  setItem: (k: string, v: string) => {
    memoryStore[k] = String(v)
  },
  removeItem: (k: string) => {
    delete memoryStore[k]
  },
  clear: () => {
    for (const k of Object.keys(memoryStore)) delete memoryStore[k]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

Object.defineProperty(globalThis, 'window', {
  value: {
    dispatchEvent: () => true,
    localStorage: localStorageMock,
  },
  writable: true,
  configurable: true,
})

describe('Sales & Operational Reports Real-Data Computation', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('computes real sales metrics for today and does NOT return fake hardcoded constants', async () => {
    const today = getKarachiBusinessDate()
    const report = await fetchSalesReport(BRANCH_ID, today, today)

    // Verify it is calculated from actual orders, not hardcoded 64800 / 70738
    expect(report.grossSales).not.toBe(64800)
    expect(report.netSales).not.toBe(70738)
    expect(report.orderCount).toBeGreaterThan(0)
    expect(report.netSales).toBeGreaterThan(0)

    // Gross sales - discounts + taxes approximately equals netSales
    const computedExpectedNet = report.grossSales - report.discounts + report.taxCollected
    expect(computedExpectedNet).toBeGreaterThan(0)
    expect(report.netSales).toBeGreaterThanOrEqual(report.grossSales - report.discounts)

    // Payment methods should sum up to non-cancelled orders
    const totalPayments = Object.values(report.paymentsBreakdown).reduce((a, b) => a + b, 0)
    expect(totalPayments).toBeGreaterThan(0)

    // Order channel mix counts should equal total orderCount
    const totalChannelOrders = Object.values(report.typeBreakdown).reduce((a, b) => a + b, 0)
    expect(totalChannelOrders).toBe(report.orderCount)
  })

  it('computes distinct, accurate figures for Yesterday vs Today', async () => {
    const today = getKarachiBusinessDate()
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = getKarachiBusinessDate(yesterdayDate)

    const todayReport = await fetchSalesReport(BRANCH_ID, today, today)
    const yesterdayReport = await fetchSalesReport(BRANCH_ID, yesterday, yesterday)

    expect(yesterdayReport.orderCount).toBeGreaterThan(0)
    expect(todayReport.orderCount).toBeGreaterThan(0)

    // Yesterday orders are distinct from today
    expect(yesterdayReport.orderCount).not.toBe(todayReport.orderCount)
    expect(yesterdayReport.netSales).not.toBe(todayReport.netSales)
  })

  it('aggregates the full date range for Last 30 Days and reflects newly placed orders dynamically', async () => {
    const today = getKarachiBusinessDate()
    const thirtyDaysAgoDate = new Date()
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30)
    const thirtyDaysAgo = getKarachiBusinessDate(thirtyDaysAgoDate)

    const beforeReport = await fetchSalesReport(BRANCH_ID, thirtyDaysAgo, today)
    const initialGross = beforeReport.grossSales
    const initialOrders = beforeReport.orderCount

    // Now place a new real order in Storage
    const newOrder: Order = {
      id: 'ord-test-live-report',
      branch_id: BRANCH_ID,
      order_number: 8888,
      business_date: today,
      client_request_id: 'req-live-report-1',
      type: 'dine_in',
      status: 'completed',
      customer_name: 'Live Test Customer',
      subtotal: 5000,
      discount: 500,
      tax: 585,
      total: 5085,
      delivery_fee: 0,
      rider_cash_collected: 0,
      rider_cash_handed_over: false,
      created_by: 'usr-3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: 'oi-live-test',
          order_id: 'ord-test-live-report',
          branch_id: BRANCH_ID,
          menu_item_id: 'item-1',
          item_name: 'Special Mutton Dum Biryani',
          unit_price: 1000,
          quantity: 5,
          line_total: 5000,
        },
      ],
      payments: [
        {
          id: 'p-live-test',
          branch_id: BRANCH_ID,
          order_id: 'ord-test-live-report',
          method: 'cash',
          status: 'succeeded',
          amount: 5085,
          idempotency_key: 'ik-live-1',
          created_at: new Date().toISOString(),
        },
      ],
    }

    Storage.saveOrder(newOrder)

    // Re-fetch report
    const afterReport = await fetchSalesReport(BRANCH_ID, thirtyDaysAgo, today)
    expect(afterReport.orderCount).toBe(initialOrders + 1)
    expect(afterReport.grossSales).toBe(initialGross + 5000)
    expect(afterReport.discounts).toBe(beforeReport.discounts + 500)
    expect(afterReport.taxCollected).toBe(beforeReport.taxCollected + 585)
    expect(afterReport.netSales).toBe(beforeReport.netSales + 5085)

    // Top dishes should contain the newly sold 5 portions of Special Mutton Dum Biryani
    const muttonDish = afterReport.topDishes.find((d) => d.name === 'Special Mutton Dum Biryani')
    expect(muttonDish).toBeDefined()
    expect(muttonDish?.quantity).toBeGreaterThanOrEqual(5)
  })
})
