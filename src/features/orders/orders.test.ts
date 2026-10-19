import { describe, expect, it, beforeEach } from 'vitest'
import { fetchOrders, updateOrderStatus, assignRider } from './api'
import { Storage } from '@/lib/storage'
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

describe('Order Section Actions and Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('fetches initial orders and filters by search query', async () => {
    const orders = await fetchOrders(BRANCH_ID)
    expect(orders.length).toBeGreaterThan(0)

    // Filter by customer name
    const ayeshaOrders = await fetchOrders(BRANCH_ID, { search: 'Ayesha' })
    expect(ayeshaOrders.length).toBe(1)
    expect(ayeshaOrders[0].order_number).toBe(1022)

    // Filter by order number
    const ord1023 = await fetchOrders(BRANCH_ID, { search: '1023' })
    expect(ord1023.length).toBe(1)
    expect(ord1023[0].customer_name).toBe('Hamza Siddiqui')
  })

  it('completing an order updates status and frees the dining table', async () => {
    // ord-1022 is dine-in on table t-3 with status 'served'
    const initialOrders = await fetchOrders(BRANCH_ID)
    const target = initialOrders.find((o) => o.id === 'ord-1022')
    expect(target).toBeDefined()
    expect(target?.status).toBe('served')
    expect(target?.table_id).toBe('t-3')

    // Complete the order
    await updateOrderStatus('ord-1022', 'completed')

    // Verify status is saved in database/storage
    const updatedOrders = await fetchOrders(BRANCH_ID)
    const completedOrder = updatedOrders.find((o) => o.id === 'ord-1022')
    expect(completedOrder?.status).toBe('completed')
    // Total, items, and payments are preserved intact
    expect(completedOrder?.total).toBe(1780)
    expect(completedOrder?.items?.length).toBe(3)
    expect(completedOrder?.payments?.length).toBe(1)

    // Verify dining table t-3 is freed
    const tables = Storage.getTables(BRANCH_ID)
    const table3 = tables.find((t) => t.id === 't-3')
    expect(table3?.current_order_id).toBeNull()
    expect(table3?.current_order_status).toBeNull()
  })

  it('cancelling an order updates status and frees the dining table without corrupting history', async () => {
    // Create an active dine-in order for Table 1
    const dineInOrder: Order = {
      id: 'ord-test-dinein',
      branch_id: BRANCH_ID,
      order_number: 9999,
      business_date: '2026-10-18',
      client_request_id: 'req-test-9999',
      type: 'dine_in',
      status: 'preparing',
      table_id: 't-1',
      customer_name: 'Test Customer',
      customer_phone: '0300-0000000',
      subtotal: 1000,
      discount: 0,
      tax: 130,
      total: 1130,
      delivery_fee: 0,
      rider_cash_collected: 0,
      rider_cash_handed_over: false,
      created_by: 'usr-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        { id: 'oi-test', order_id: 'ord-test-dinein', branch_id: BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 1000, quantity: 1, line_total: 1000 }
      ],
      payments: [],
    }
    Storage.saveOrder(dineInOrder)
    Storage.updateTableStatus('t-1', 'ord-test-dinein', 'preparing')

    // Verify table 1 is occupied
    let tables = Storage.getTables(BRANCH_ID)
    let table1 = tables.find((t) => t.id === 't-1')
    expect(table1?.current_order_id).toBe('ord-test-dinein')
    expect(table1?.current_order_status).toBe('preparing')

    // Cancel the order
    await updateOrderStatus('ord-test-dinein', 'cancelled', 'Customer emergency cancellation')

    const updatedOrders = await fetchOrders(BRANCH_ID)
    const cancelled = updatedOrders.find((o) => o.id === 'ord-test-dinein')
    expect(cancelled?.status).toBe('cancelled')
    expect(cancelled?.notes).toBe('Customer emergency cancellation')
    expect(cancelled?.total).toBe(1130) // Original total preserved
    expect(cancelled?.items?.length).toBe(1) // Items preserved

    // Table t-1 freed
    tables = Storage.getTables(BRANCH_ID)
    table1 = tables.find((t) => t.id === 't-1')
    expect(table1?.current_order_id).toBeNull()
    expect(table1?.current_order_status).toBeNull()
  })

  it('assigning a delivery rider updates rider info and status', async () => {
    await assignRider('ord-1023', 'Babar Azam (Bykea)', '0300-1122334', 'out_for_delivery')

    const updatedOrders = await fetchOrders(BRANCH_ID)
    const deliveryOrder = updatedOrders.find((o) => o.id === 'ord-1023')
    expect(deliveryOrder?.rider_name).toBe('Babar Azam (Bykea)')
    expect(deliveryOrder?.rider_phone).toBe('0300-1122334')
    expect(deliveryOrder?.rider_status).toBe('out_for_delivery')
  })
})

describe('Menu Item Image Mapping Verification', () => {
  it('assigns authentic dish images for specific Pakistani delicacies', () => {
    const items = Storage.getMenuItems(BRANCH_ID)

    const garlicNaan = items.find((i) => i.id === 'item-7')
    expect(garlicNaan?.name).toBe('Garlic Roghani Naan')
    expect(garlicNaan?.image_url).toBe('/dishes/garlic_naan.jpg')

    const doodhPatti = items.find((i) => i.id === 'item-9')
    expect(doodhPatti?.name).toBe('Karak Doodh Patti Chai')
    expect(doodhPatti?.image_url).toBe('/dishes/karak_chai.jpg')

    const chickenTikka = items.find((i) => i.id === 'item-6')
    expect(chickenTikka?.name).toBe('Chicken Tikka (Chest Piece)')
    expect(chickenTikka?.image_url).toBe('/dishes/chicken_tikka.jpg')

    const beefKabab = items.find((i) => i.id === 'item-4')
    expect(beefKabab?.name).toBe('Beef Seekh Kabab (4 Pcs)')
    expect(beefKabab?.image_url).toBe('/dishes/beef_kabab.jpg')

    const fishChips = items.find((i) => i.id === 'item-5')
    expect(fishChips?.name).toBe('Fish & Chips (British classic)')
    expect(fishChips?.image_url).toBe('/dishes/fish_chips.jpg')
  })
})
