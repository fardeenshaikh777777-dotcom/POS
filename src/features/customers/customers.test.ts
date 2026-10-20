import { describe, expect, it } from 'vitest'
import {
  normalizePhoneNumber,
  formatPakistaniPhone,
  isValidPhoneNumber,
} from '../../lib/phoneNormalizer'
import { Storage } from '../../lib/storage'
import type { Order } from '../../types/domain'

const TEST_BRANCH = '635c7b14-54be-4b93-a75a-e2ddc0323827'

describe('Customer CRM & Phone Normalization', () => {
  describe('Pakistani Phone Number Normalization', () => {
    it('normalizes local 11-digit 03xx format to international E.164 +923xxxxxxxxx', () => {
      expect(normalizePhoneNumber('03001234567')).toBe('+923001234567')
      expect(normalizePhoneNumber('0345-7654321')).toBe('+923457654321')
      expect(normalizePhoneNumber('0321 9876543')).toBe('+923219876543')
    })

    it('normalizes international formats with spaces or leading zeroes', () => {
      expect(normalizePhoneNumber('+92 300 1234567')).toBe('+923001234567')
      expect(normalizePhoneNumber('00923001234567')).toBe('+923001234567')
      expect(normalizePhoneNumber('923001234567')).toBe('+923001234567')
    })

    it('formats normalized number into clean local display format 03xx-xxxxxxx', () => {
      expect(formatPakistaniPhone('+923001234567')).toBe('0300-1234567')
      expect(formatPakistaniPhone('03451122334')).toBe('0345-1122334')
    })

    it('validates Pakistani phone numbers correctly', () => {
      expect(isValidPhoneNumber('03001234567')).toBe(true)
      expect(isValidPhoneNumber('+923457654321')).toBe(true)
      expect(isValidPhoneNumber('12345')).toBe(false)
      expect(isValidPhoneNumber('abc-def-ghij')).toBe(false)
      expect(isValidPhoneNumber('')).toBe(false)
    })
  })

  describe('Automatic Profile Linking on Reservations', () => {
    it('creates and links a new customer profile when booking with new phone', () => {
      const uniquePhone = `0312${Date.now().toString().slice(-7)}`
      const reservation = Storage.saveReservation(TEST_BRANCH, {
        customer_name: 'Zubair Khan',
        customer_phone: uniquePhone,
        party_size: 4,
        reservation_date: '2026-10-25',
        reservation_time: '20:30',
        marketing_consent: 'opted_in',
        notes: 'Window table requested',
      })

      expect(reservation.id).toBeDefined()
      expect(reservation.customer_id).toBeDefined()

      // Customer must now exist in CRM with correct profile and normalized phone
      const customers = Storage.getCustomers(TEST_BRANCH)
      const matched = customers.find((c) => c.id === reservation.customer_id)
      expect(matched).toBeDefined()
      expect(matched?.name).toBe('Zubair Khan')
      expect(normalizePhoneNumber(matched?.phone)).toBe(normalizePhoneNumber(uniquePhone))
      expect(matched?.marketing_consent).toBe('opted_in')
      expect(matched?.last_reservation_at).toBeDefined()
      // Spend should NOT be incremented by reservations
      expect(matched?.total_spent).toBe(0)
    })

    it('reuses existing customer profile when booking with same phone without duplicating', () => {
      const fixedPhone = `0333${Date.now().toString().slice(-7)}`
      
      // Booking 1
      const res1 = Storage.saveReservation(TEST_BRANCH, {
        customer_name: 'Bilal Farooq',
        customer_phone: fixedPhone,
        party_size: 2,
        reservation_date: '2026-10-26',
        reservation_time: '19:00',
      })

      const countAfterFirst = Storage.getCustomers(TEST_BRANCH).length

      // Booking 2 with same phone (different spacing)
      const res2 = Storage.saveReservation(TEST_BRANCH, {
        customer_name: 'Bilal Farooq',
        customer_phone: ` ${fixedPhone.slice(0, 4)} ${fixedPhone.slice(4)} `,
        party_size: 3,
        reservation_date: '2026-10-27',
        reservation_time: '21:00',
      })

      const countAfterSecond = Storage.getCustomers(TEST_BRANCH).length

      expect(res1.customer_id).toBe(res2.customer_id)
      expect(countAfterSecond).toBe(countAfterFirst) // No duplicate customer created!
    })

    it('safely saves reservation without phone/name without creating false customer identity', () => {
      const countBefore = Storage.getCustomers(TEST_BRANCH).length
      const res = Storage.saveReservation(TEST_BRANCH, {
        tableId: 't-3',
        customer_name: 'Walk-in Guest',
        customer_phone: '',
        party_size: 2,
        reservation_date: '2026-10-30',
        reservation_time: '14:00',
      })

      const countAfter = Storage.getCustomers(TEST_BRANCH).length
      expect(res.id).toBeDefined()
      expect(countAfter).toBe(countBefore) // No phantom customer created
    })
  })

  describe('Authoritative Order Spend and Cancellation Rules', () => {
    it('only completed orders increment total_orders and total_spent; reservations do not', () => {
      const testPhone = `0322${Date.now().toString().slice(-7)}`
      const customer = Storage.saveCustomer(TEST_BRANCH, {
        name: 'Tariq Mehmood',
        phone: testPhone,
        marketing_consent: 'opted_in',
      })

      expect(customer.total_orders).toBe(0)
      expect(customer.total_spent).toBe(0)

      // Place open order (not yet completed)
      const openOrder: Order = {
        id: `ord-test-${Date.now()}`,
        branch_id: TEST_BRANCH,
        order_number: 901,
        business_date: '2026-10-20',
        client_request_id: `req-${Date.now()}`,
        type: 'dine_in',
        status: 'open',
        delivery_fee: 0,
        rider_cash_collected: 0,
        rider_cash_handed_over: false,
        subtotal: 2000,
        tax: 260,
        discount: 0,
        deal_discount: 0,
        total: 2260,
        customer_id: customer.id,
        created_by: 'staff-1',
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      Storage.saveOrder(TEST_BRANCH, openOrder)
      let c = Storage.getCustomers(TEST_BRANCH).find((x) => x.id === customer.id)
      // Open order must NOT increment customer totals
      expect(c?.total_orders).toBe(0)
      expect(c?.total_spent).toBe(0)

      // Now complete the order
      const completedOrder: Order = {
        ...openOrder,
        status: 'completed',
      }
      Storage.saveOrder(TEST_BRANCH, completedOrder)
      c = Storage.getCustomers(TEST_BRANCH).find((x) => x.id === customer.id)
      expect(c?.total_orders).toBe(1)
      expect(c?.total_spent).toBe(2260)
      expect(c?.last_order_at).toBeDefined()

      // Now cancel the order: customer totals must be reversed
      const cancelledOrder: Order = {
        ...completedOrder,
        status: 'cancelled',
      }
      Storage.saveOrder(TEST_BRANCH, cancelledOrder)
      c = Storage.getCustomers(TEST_BRANCH).find((x) => x.id === customer.id)
      expect(c?.total_orders).toBe(0)
      expect(c?.total_spent).toBe(0)
    })
  })

  describe('Marketing Consent Management', () => {
    it('allows updating customer consent and filters audience accurately', () => {
      const phoneOptIn = `0341${Date.now().toString().slice(-7)}`
      const phoneOptOut = `0342${Date.now().toString().slice(-7)}`

      const cust1 = Storage.saveCustomer(TEST_BRANCH, {
        name: 'Mustafa Ali',
        phone: phoneOptIn,
        marketing_consent: 'opted_in',
      })

      const cust2 = Storage.saveCustomer(TEST_BRANCH, {
        name: 'Sara Khan',
        phone: phoneOptOut,
        marketing_consent: 'opted_out',
      })

      const optedInList = Storage.getCustomers(TEST_BRANCH, { marketing_consent: 'opted_in' })
      expect(optedInList.some((c) => c.id === cust1.id)).toBe(true)
      expect(optedInList.some((c) => c.id === cust2.id)).toBe(false)

      const optedOutList = Storage.getCustomers(TEST_BRANCH, { marketing_consent: 'opted_out' })
      expect(optedOutList.some((c) => c.id === cust2.id)).toBe(true)

      // Test consent toggle
      Storage.updateCustomerConsent(TEST_BRANCH, cust2.id, 'opted_in')
      const updatedCust2 = Storage.getCustomers(TEST_BRANCH).find((c) => c.id === cust2.id)
      expect(updatedCust2?.marketing_consent).toBe('opted_in')
    })
  })
})
