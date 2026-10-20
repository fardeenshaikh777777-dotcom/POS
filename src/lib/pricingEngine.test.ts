import { describe, expect, it } from 'vitest'
import {
  checkDealEligibility,
  calculateDealDiscount,
  type CartItemLike,
} from './pricingEngine'
import type { Deal, MenuItem } from '../types/domain'

const dummyItemA: MenuItem = {
  id: 'item-burger-1',
  branch_id: 'branch-1',
  category_id: 'cat-burgers',
  name: 'Karachi Zinger Crunch',
  price: 650,
  is_available: true,
}

const dummyItemB: MenuItem = {
  id: 'item-drink-1',
  branch_id: 'branch-1',
  category_id: 'cat-drinks',
  name: 'Pakola Cold Drink',
  price: 150,
  is_available: true,
}

const dummyItemC: MenuItem = {
  id: 'item-fries-1',
  branch_id: 'branch-1',
  category_id: 'cat-sides',
  name: 'Masala Fries',
  price: 250,
  is_available: true,
}

describe('Pricing Engine - Deals & Promotions', () => {
  describe('Combo Deals', () => {
    const comboDeal: Deal = {
      id: 'deal-combo-1',
      branch_id: 'branch-1',
      name: 'Burger & Drink Deal',
      deal_type: 'combo',
      discount_type: 'combo_price',
      discount_value: 700, // combo bundle price: 700 (original: 650 + 150 = 800)
      combo_price: 700,
      is_active: true,
      applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
      applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      times_redeemed: 0,
      items: [
        { id: 'di-1', deal_id: 'deal-combo-1', menu_item_id: dummyItemA.id, required_quantity: 1, is_free: false },
        { id: 'di-2', deal_id: 'deal-combo-1', menu_item_id: dummyItemB.id, required_quantity: 1, is_free: false },
      ],
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('rejects combo when cart is missing required items', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 1 }]
      const check = checkDealEligibility(comboDeal, {
        orderType: 'dine_in',
        subtotal: 650,
        cart,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/Cart missing required combo item/)
    })

    it('approves combo and calculates exact discount when required items are present', () => {
      const cart: CartItemLike[] = [
        { menuItem: dummyItemA, quantity: 1 },
        { menuItem: dummyItemB, quantity: 1 },
      ]
      const res = calculateDealDiscount(comboDeal, cart, 'dine_in')
      expect(res.isEligible).toBe(true)
      // Original subtotal = 650 + 150 = 800. Combo price = 700. Discount = 100.
      expect(res.dealDiscount).toBe(100)
      expect(res.finalSubtotal).toBe(700)
    })
  })

  describe('Buy One Get One (BOGO) Deals', () => {
    const bogoDeal: Deal = {
      id: 'deal-bogo-1',
      branch_id: 'branch-1',
      name: 'BOGO Seekh Kabab / Burger',
      deal_type: 'bogo',
      discount_type: 'free_item',
      discount_value: 100,
      is_active: true,
      applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
      applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      times_redeemed: 0,
      items: [
        { id: 'di-bogo-1', deal_id: 'deal-bogo-1', menu_item_id: dummyItemA.id, required_quantity: 1, is_free: true },
      ],
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('rejects BOGO if fewer than 2 qualifying items in cart', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 1 }]
      const check = checkDealEligibility(bogoDeal, {
        orderType: 'dine_in',
        subtotal: 650,
        cart,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/requires at least 2 qualifying items/)
    })

    it('discounts 1 free item when 2 or 3 items are present', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }]
      const res = calculateDealDiscount(bogoDeal, cart, 'dine_in')
      expect(res.isEligible).toBe(true)
      // 2 burgers @ 650 = 1300. 1 free = 650 discount.
      expect(res.dealDiscount).toBe(650)
      expect(res.finalSubtotal).toBe(650)
    })

    it('discounts 2 free items when 4 items are present', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 4 }]
      const res = calculateDealDiscount(bogoDeal, cart, 'dine_in')
      expect(res.isEligible).toBe(true)
      // 4 burgers @ 650 = 2600. 2 free = 1300 discount.
      expect(res.dealDiscount).toBe(1300)
      expect(res.finalSubtotal).toBe(1300)
    })
  })

  describe('Percentage Discount with Cap and Minimum Order Threshold', () => {
    const pctDeal: Deal = {
      id: 'deal-pct-1',
      branch_id: 'branch-1',
      name: '15% Off Orders Above 1500 (Max 300)',
      deal_type: 'percentage_discount',
      discount_type: 'percentage',
      discount_value: 15,
      min_order_amount: 1500,
      max_discount_amount: 300,
      is_active: true,
      applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
      applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      times_redeemed: 0,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('rejects when order is below minimum order amount', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }] // 1300
      const check = checkDealEligibility(pctDeal, {
        orderType: 'dine_in',
        subtotal: 1300,
        cart,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/Minimum order of Rs\. 1,500 required/)
    })

    it('applies percentage when above threshold but respects maximum discount cap', () => {
      // 4 burgers @ 650 = 2600. 15% of 2600 is 390. Cap is 300.
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 4 }]
      const res = calculateDealDiscount(pctDeal, cart, 'dine_in')
      expect(res.isEligible).toBe(true)
      expect(res.dealDiscount).toBe(300) // capped at 300
      expect(res.finalSubtotal).toBe(2300)
    })
  })

  describe('Flat PKR Discount', () => {
    const flatDeal: Deal = {
      id: 'deal-flat-1',
      branch_id: 'branch-1',
      name: 'Flat Rs. 200 Off Orders Above 1000',
      deal_type: 'flat_discount',
      discount_type: 'fixed',
      discount_value: 200,
      min_order_amount: 1000,
      is_active: true,
      applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
      applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      times_redeemed: 0,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('applies exactly Rs. 200 discount', () => {
      const cart: CartItemLike[] = [
        { menuItem: dummyItemA, quantity: 1 }, // 650
        { menuItem: dummyItemB, quantity: 1 }, // 150
        { menuItem: dummyItemC, quantity: 1 }, // 250
      ] // Total: 1050
      const res = calculateDealDiscount(flatDeal, cart, 'dine_in')
      expect(res.isEligible).toBe(true)
      expect(res.dealDiscount).toBe(200)
      expect(res.finalSubtotal).toBe(850)
    })
  })

  describe('Schedule, Weekday and Order Type Restrictions', () => {
    const weekendDeliveryOnly: Deal = {
      id: 'deal-sched-1',
      branch_id: 'branch-1',
      name: 'Weekend Delivery Special',
      deal_type: 'flat_discount',
      discount_type: 'fixed',
      discount_value: 100,
      applicable_order_types: ['delivery'],
      applicable_weekdays: [0, 6], // Sunday = 0, Saturday = 6
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      times_redeemed: 0,
      is_active: true,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('rejects if order type is dine_in or takeaway', () => {
      const sundayDate = new Date('2026-10-25T14:00:00Z') // Sunday
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }]
      const check = checkDealEligibility(weekendDeliveryOnly, {
        orderType: 'dine_in',
        subtotal: 1300,
        cart,
        currentTime: sundayDate,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/Valid only for: delivery/)
    })

    it('rejects if ordered on a weekday (e.g. Wednesday)', () => {
      const wednesdayDate = new Date('2026-10-21T14:00:00Z') // Wednesday
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }]
      const check = checkDealEligibility(weekendDeliveryOnly, {
        orderType: 'delivery',
        subtotal: 1300,
        cart,
        currentTime: wednesdayDate,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/Valid only on/)
    })

    it('approves on Sunday for delivery order', () => {
      const sundayDate = new Date('2026-10-25T14:00:00Z') // Sunday
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }]
      const check = checkDealEligibility(weekendDeliveryOnly, {
        orderType: 'delivery',
        subtotal: 1300,
        cart,
        currentTime: sundayDate,
      })
      expect(check.isEligible).toBe(true)
    })
  })

  describe('Redemption Limits', () => {
    const limitedDeal: Deal = {
      id: 'deal-limit-1',
      branch_id: 'branch-1',
      name: 'Flash Promo',
      deal_type: 'flat_discount',
      discount_type: 'fixed',
      discount_value: 150,
      redemption_limit: 5,
      times_redeemed: 5,
      is_active: true,
      applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
      applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '2026-01-01T00:00:00Z',
      is_stackable: false,
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    }

    it('rejects when deal has reached maximum total redemptions', () => {
      const cart: CartItemLike[] = [{ menuItem: dummyItemA, quantity: 2 }]
      const check = checkDealEligibility(limitedDeal, {
        orderType: 'dine_in',
        subtotal: 1300,
        cart,
      })
      expect(check.isEligible).toBe(false)
      expect(check.reason).toMatch(/Maximum promotion redemption limit reached/)
    })
  })
})
