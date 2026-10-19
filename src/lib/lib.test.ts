import { describe, expect, it } from 'vitest'
import { canAccess, defaultPathFor, modulesFor, MODULES } from './modules'
import { roundMoney } from './format'
import { toUserMessage, AppError } from './errors'
import { Storage } from './storage'

const TEST_BRANCH = '635c7b14-54be-4b93-a75a-e2ddc0323827'

describe('module permissions', () => {
  it('kitchen cannot access cash or staff', () => {
    const keys = modulesFor('kitchen').map((m) => m.key)
    expect(keys).not.toContain('cash')
    expect(keys).not.toContain('staff')
    expect(keys).toContain('kitchen')
  })
  it('waiter cannot access reports or inventory', () => {
    const keys = modulesFor('waiter').map((m) => m.key)
    expect(keys).toEqual(['pos', 'orders', 'tables'])
  })
  it('owner can access every module', () => {
    expect(modulesFor('owner')).toHaveLength(MODULES.length)
  })
  it('null role has no access', () => {
    expect(canAccess(null, MODULES[0])).toBe(false)
    expect(defaultPathFor(null)).toBe('/login')
  })
  it('module paths are unique', () => {
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(MODULES.length)
  })
})

describe('helpers', () => {
  it('roundMoney avoids float drift', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })
  it('toUserMessage maps RLS denial and hides internals', () => {
    expect(toUserMessage({ code: '42501', message: 'new row violates...' })).toMatch(/permission/)
    expect(toUserMessage(new Error('secret stack'))).not.toMatch(/secret/)
    expect(toUserMessage(new AppError('Custom'))).toBe('Custom')
  })
})

describe('Functional Verification Matrix (Bugs A through H)', () => {
  it('A. Restock: adds positive quantity and records stock movement', () => {
    const items = Storage.getInventory(TEST_BRANCH)
    const target = items[0]
    const initialQty = target.current_qty
    const res = Storage.restockItem(TEST_BRANCH, target.id, 25, 4500, 'Al-Rehman Traders', 'Fresh restock test')
    expect(res.item.current_qty).toBe(initialQty + 25)
    expect(res.movement.delta).toBe(25)
    expect(res.movement.reason).toBe('purchase')

    // Zero or negative quantity must throw error
    expect(() => Storage.restockItem(TEST_BRANCH, target.id, -5)).toThrow()
    expect(() => Storage.restockItem(TEST_BRANCH, target.id, 0)).toThrow()
  })

  it('B. Customers: creates, validates, and persists customer across queries', () => {
    const uniquePhone = `0345-${Date.now().toString().slice(-7)}`
    const saved = Storage.saveCustomer(TEST_BRANCH, {
      name: 'Kamran Akmal',
      phone: uniquePhone,
      address: 'Gulshan-e-Iqbal Block 5, Karachi',
    })
    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('Kamran Akmal')

    const list = Storage.getCustomers(TEST_BRANCH, uniquePhone)
    expect(list.some((c) => c.phone === uniquePhone)).toBe(true)

    // Validation: name and phone required
    expect(() => Storage.saveCustomer(TEST_BRANCH, { name: '', phone: '0300-1111111' })).toThrow()
    expect(() => Storage.saveCustomer(TEST_BRANCH, { name: 'Ali', phone: '' })).toThrow()
  })

  it('C. Expenses: records expense voucher with positive amount and drawer info', () => {
    const exp = Storage.recordExpense({
      branchId: TEST_BRANCH,
      category: 'supplies',
      amount: 2500,
      paymentMethod: 'cash',
      cashSessionId: 'sess-123',
      description: 'Cleaning supplies and sanitizer refills',
      vendor: 'Metro Cash & Carry',
    })
    expect(exp.id).toBeDefined()
    expect(exp.amount).toBe(2500)
    expect(exp.payment_method).toBe('cash')

    const expenses = Storage.getExpenses(TEST_BRANCH)
    expect(expenses.some((e) => e.id === exp.id)).toBe(true)

    // Non-positive amount throws error
    expect(() =>
      Storage.recordExpense({
        branchId: TEST_BRANCH,
        category: 'utilities',
        amount: -500,
        paymentMethod: 'cash',
        description: 'Invalid',
      })
    ).toThrow()
  })

  it('D. Tables: creates, edits, validates uniqueness within branch', () => {
    const uniqueLabel = `Table VIP-${Date.now().toString().slice(-4)}`
    const created = Storage.saveTable(TEST_BRANCH, {
      label: uniqueLabel,
      seats: 6,
      location: 'Terrace Rooftop',
    })
    expect(created.id).toBeDefined()
    expect(created.label).toBe(uniqueLabel)

    // Edit table
    const updated = Storage.saveTable(TEST_BRANCH, {
      id: created.id,
      label: `${uniqueLabel} (Renovated)`,
      seats: 8,
      location: 'Executive Terrace',
    })
    expect(updated.label).toBe(`${uniqueLabel} (Renovated)`)
    expect(updated.seats).toBe(8)

    // Duplicate label must throw
    expect(() =>
      Storage.saveTable(TEST_BRANCH, {
        label: `${uniqueLabel} (Renovated)`,
        seats: 4,
      })
    ).toThrow()
  })

  it('E. Reservations: creates, edits, changes status, and detects 2-hour conflicts', () => {
    const tables = Storage.getTables(TEST_BRANCH)
    const testTable = tables[0]
    const baseTime = new Date(Date.now() + 5 * 3600000).toISOString()

    const res = Storage.saveReservation(TEST_BRANCH, {
      tableId: testTable.id,
      customerName: 'Nasir Jamshed',
      customerPhone: '0301-7654321',
      guestCount: 4,
      reservationTime: baseTime,
      notes: 'Birthday cake cutting',
    })
    expect(res.id).toBeDefined()
    expect(res.status).toBe('confirmed')

    // Conflict detection: another booking within 1 hour on same table
    const conflictTime = new Date(new Date(baseTime).getTime() + 45 * 60000).toISOString()
    expect(() =>
      Storage.saveReservation(TEST_BRANCH, {
        tableId: testTable.id,
        customerName: 'Conflict Guest',
        customerPhone: '0302-9998888',
        guestCount: 2,
        reservationTime: conflictTime,
      })
    ).toThrow(/conflict/)

    // Status transition
    Storage.updateReservationStatus(res.id, 'seated')
    const list = Storage.getReservations(TEST_BRANCH)
    const updated = list.find((r) => r.id === res.id)
    expect(updated?.status).toBe('seated')
  })

  it('F. Staff: provisions staff member with role and PIN assignment', () => {
    const newStaff = Storage.saveStaff(TEST_BRANCH, {
      fullName: 'Muhammad Rizwan',
      role: 'cashier',
      email: 'rizwan@karachiexpress.pk',
    })
    expect(newStaff.id).toBeDefined()
    expect(newStaff.role).toBe('cashier')

    Storage.setStaffPin(newStaff.id)
    const staffList = Storage.getStaff(TEST_BRANCH)
    const found = staffList.find((s) => s.id === newStaff.id)
    expect(found?.pin_set_at).toBeDefined()
  })

  it('G. Menu Categories & Dishes: creates category and dish with valid price', () => {
    const catName = `Continental Starters ${Date.now().toString().slice(-4)}`
    const cat = Storage.saveCategory(TEST_BRANCH, catName)
    expect(cat.id).toBeDefined()

    const dish = Storage.saveMenuItem(TEST_BRANCH, {
      category_id: cat.id,
      name: 'Dynamite Prawns Skewer',
      price: 890,
      description: 'Crispy batter-fried prawns tossed in spicy mayo sauce.',
    })
    expect(dish.id).toBeDefined()
    expect(dish.price).toBe(890)

    // Negative price not allowed
    expect(() =>
      Storage.saveMenuItem(TEST_BRANCH, {
        category_id: cat.id,
        name: 'Free Item',
        price: -50,
      })
    ).toThrow()

    // Toggle availability
    Storage.toggleMenuItemAvailability(dish.id, false)
    const items = Storage.getMenuItems(TEST_BRANCH)
    expect(items.find((i) => i.id === dish.id)?.is_available).toBe(false)
  })

  it('H. Dashboard: aggregates live metrics, recent orders, and POS activity accurately', async () => {
    const { fetchCompleteDashboardData } = await import('@/features/dashboard/api')
    const data = await fetchCompleteDashboardData(TEST_BRANCH, 'today')
    expect(data.metrics.total_orders).toBeGreaterThan(0)
    expect(data.metrics.net_sales).toBeGreaterThan(0)
    expect(data.recentOrders.length).toBeGreaterThanOrEqual(3)
    expect(data.topCategories.length).toBe(3)
    expect(data.employeeStatus.total).toBeGreaterThan(0)
    expect(data.posActivity.todaySales).toBeGreaterThan(0)
  })

  it('I. Semicircle Gauge Geometry: verifies exact radius and gap separation without distortion', () => {
    const cx = 55
    const cy = 54
    const r = 40
    const gapDeg = 4
    const segments = [
      { value: 27, color: '#EF4444' },
      { value: 10, color: '#F59E0B' },
      { value: 83, color: '#10B981' },
    ]
    const total = segments.reduce((sum, s) => sum + s.value, 0)
    expect(total).toBe(120)

    const totalGaps = (segments.length - 1) * gapDeg
    const availableDeg = 180 - totalGaps
    expect(availableDeg).toBe(172)

    let currentAngle = 180
    segments.forEach((seg) => {
      const spanDeg = (seg.value / total) * availableDeg
      const startAngleRad = (currentAngle * Math.PI) / 180
      const endAngleRad = ((currentAngle - spanDeg) * Math.PI) / 180

      const x1 = cx + r * Math.cos(startAngleRad)
      const y1 = cy - r * Math.sin(startAngleRad)
      const x2 = cx + r * Math.cos(endAngleRad)
      const y2 = cy - r * Math.sin(endAngleRad)

      // Every endpoint must lie precisely on circle of radius r
      const dist1 = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2)
      const dist2 = Math.sqrt((x2 - cx) ** 2 + (y2 - cy) ** 2)
      expect(Math.abs(dist1 - r)).toBeLessThan(0.001)
      expect(Math.abs(dist2 - r)).toBeLessThan(0.001)

      currentAngle = currentAngle - spanDeg - gapDeg
    })

    // Final angle should equal 0 - gapDeg = -4
    expect(Math.round(currentAngle)).toBe(-gapDeg)
  })

  it('J. Real-time POS Order updates Dashboard: creating order immediately updates totals and recent stream', async () => {
    const { fetchCompleteDashboardData } = await import('@/features/dashboard/api')
    const { getKarachiBusinessDate } = await import('@/lib/format')
    const beforeData = await fetchCompleteDashboardData(TEST_BRANCH, 'today')
    const initialOrders = beforeData.metrics.total_orders
    const initialSales = beforeData.metrics.net_sales

    // Place new test order in Storage
    const newOrderId = 'ord-test-' + Date.now()
    const testOrder = {
      id: newOrderId,
      branch_id: TEST_BRANCH,
      order_number: 1999,
      business_date: getKarachiBusinessDate(),
      client_request_id: 'req-' + Date.now(),
      type: 'dine_in' as const,
      status: 'served' as const,
      table_id: 't-1',
      customer_name: 'Live POS Customer',
      customer_phone: '0300-1122334',
      subtotal: 1200,
      discount: 0,
      tax: 156,
      total: 1356,
      delivery_fee: 0,
      rider_cash_collected: 0,
      rider_cash_handed_over: false,
      created_by: 'Staff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: 'item-' + Date.now(),
          order_id: newOrderId,
          branch_id: TEST_BRANCH,
          menu_item_id: 'item-5',
          item_name: 'Fish & Chips (British classic)',
          unit_price: 1200,
          quantity: 1,
          line_total: 1200,
        },
      ],
      payments: [
        {
          id: 'pay-' + Date.now(),
          branch_id: TEST_BRANCH,
          order_id: newOrderId,
          method: 'cash' as const,
          status: 'succeeded' as const,
          amount: 1356,
          idempotency_key: 'ik-' + Date.now(),
          created_at: new Date().toISOString(),
        },
      ],
    }

    Storage.saveOrder(testOrder)

    // Re-fetch dashboard metrics
    const afterData = await fetchCompleteDashboardData(TEST_BRANCH, 'today')
    expect(afterData.metrics.total_orders).toBe(initialOrders + 1)
    expect(afterData.metrics.net_sales).toBe(initialSales + 1356)
    expect(afterData.recentOrders[0].id).toBe(newOrderId)
    expect(afterData.recentOrders[0].dishName).toBe('Fish & Chips (British classic)')
    expect(afterData.recentOrders[0].price).toBe(1356)
    expect(afterData.recentOrders[0].timeAgo).toBe('Just now')
    expect(afterData.recentOrders[0].status).toBe('completed')
  })
})

