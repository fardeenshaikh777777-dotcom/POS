import { useEffect, useState, useMemo, useCallback, useDeferredValue, memo } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, Field } from '@/components/ui'
import { formatPKR, getKarachiBusinessDate } from '@/lib/format'
import { Storage } from '@/lib/storage'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchMenuCategories,
  fetchMenuItems,
  fetchDiningTables,
  searchCustomers,
  createOrder,
  settlePayment,
  getOfflineQueue,
  flushOfflineQueue,
} from './api'
import { fetchActiveCashSession } from '@/features/cash/api'
import { fetchActiveDeals } from '@/features/deals/api'
import { checkDealEligibility, calculateDealDiscount } from '@/lib/pricingEngine'
import { ReceiptModal } from '@/components/ReceiptModal'
import type { MenuCategory, MenuItem, DiningTable, OrderType, PaymentMethod, Order, Deal, Customer } from '@/types/domain'

interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes: string
}

interface DishCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
}

const DishCard = memo(function DishCard({ item, onAdd }: DishCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className="dish-card"
      onClick={() => item.is_available && onAdd(item)}
      style={{ opacity: item.is_available ? 1 : 0.6 }}
    >
      <div>
        <div className="dish-card__img-wrap">
          {item.image_url && !imgError ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="dish-card__img"
              loading="lazy"
              decoding="async"
              width="240"
              height="150"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="dish-card__placeholder" aria-hidden="true">
              <span>🍽️</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <span className="dish-card__name">{item.name}</span>
          {!item.is_available && <Badge tone="danger">86'd</Badge>}
        </div>
        {item.description && <p className="dish-card__desc">{item.description}</p>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <span className="dish-card__price">{formatPKR(item.price)}</span>
        <button
          type="button"
          className="btn btn--sm btn--accent"
          disabled={!item.is_available}
          onClick={(e) => {
            e.stopPropagation()
            if (item.is_available) onAdd(item)
          }}
        >
          + Add
        </button>
      </div>
    </div>
  )
})

export function PosPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Order Details State
  const [orderType, setOrderType] = useState<OrderType>('dine_in')
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null)
  const [activeDeals, setActiveDeals] = useState<Deal[]>([])
  const [selectedDealId, setSelectedDealId] = useState<string>('')
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [orderNotes, setOrderNotes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])

  // Settlement & Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [tenderAmount, setTenderAmount] = useState<string>('')
  const [providerRef, setProviderRef] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)

  // Offline queue indicator
  const [queueCount, setQueueCount] = useState<number>(0)
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cats, mItems, tList, session, dealsData] = await Promise.all([
        fetchMenuCategories(branchId),
        fetchMenuItems(branchId),
        fetchDiningTables(branchId),
        fetchActiveCashSession(branchId),
        fetchActiveDeals(branchId),
      ])
      setCategories(cats)
      setItems(mItems)
      setTables(tList)
      setActiveDeals(dealsData)
      if (tList.length > 0) {
        setSelectedTableId((prev) => prev || tList[0].id)
      }
      setActiveSessionId(session?.id || null)
      setQueueCount(getOfflineQueue().length)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Phone lookup
  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val)
    if (val.length >= 7) {
      const results = await searchCustomers(branchId, val)
      if (results.length > 0) {
        setMatchedCustomer(results[0])
        setCustomerName(results[0].name)
        if (results[0].address) setDeliveryAddress(results[0].address)
      } else {
        setMatchedCustomer(null)
      }
    } else {
      setMatchedCustomer(null)
    }
  }

  // Cart operations
  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id)
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }]
    })
  }, [])

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.menuItem.id === itemId) {
            const newQty = ci.quantity + delta
            return newQty > 0 ? { ...ci, quantity: newQty } : null
          }
          return ci
        })
        .filter(Boolean) as CartItem[]
    })
  }, [])

  const updateItemNotes = useCallback((itemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.menuItem.id === itemId ? { ...ci, notes } : ci))
    )
  }, [])

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0)
  }, [cart])

  const selectedDeal = useMemo(() => {
    return activeDeals.find((d) => d.id === selectedDealId) || null
  }, [activeDeals, selectedDealId])

  const dealEligibility = useMemo(() => {
    if (!selectedDeal) return { isEligible: true, discount: 0, reason: '', summary: '' }
    const check = checkDealEligibility(selectedDeal, {
      orderType,
      subtotal,
      cart,
    })
    if (!check.isEligible) {
      return { isEligible: false, discount: 0, reason: check.reason || 'Not eligible', summary: '' }
    }
    const calc = calculateDealDiscount(selectedDeal, cart, orderType)
    return { isEligible: true, discount: calc.dealDiscount, reason: '', summary: calc.summary }
  }, [selectedDeal, orderType, subtotal, cart])

  const dealDiscount = dealEligibility.isEligible ? dealEligibility.discount : 0
  const manualDiscount = Math.min(discountAmount, Math.max(0, subtotal - dealDiscount))
  const discount = dealDiscount + manualDiscount
  const taxableAmount = Math.max(0, subtotal - discount)
  const tax = Math.round(taxableAmount * 0.13) // 13% SST
  const deliveryFee = orderType === 'delivery' ? 150 : 0
  const total = taxableAmount + tax + deliveryFee

  const changeDue = Math.max(0, (parseFloat(tenderAmount) || 0) - total)

  // Filtered menu items using deferredSearch for zero-latency typing
  const filteredItems = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return items.filter((it) => {
      const matchesCat = selectedCat === 'all' || it.category_id === selectedCat
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.description && it.description.toLowerCase().includes(q))
      return matchesCat && matchesSearch
    })
  }, [items, selectedCat, deferredSearch])

  // Sync offline queue
  const handleSyncQueue = async () => {
    setSyncing(true)
    await flushOfflineQueue()
    setQueueCount(getOfflineQueue().length)
    setSyncing(false)
  }

  // Handle checkout submission
  const handleProceedToPayment = () => {
    if (cart.length === 0) return
    setTenderAmount(total.toString())
    setPaymentModalOpen(true)
  }

  const handleCompleteOrder = async () => {
    setSubmitting(true)
    try {
      const clientReqId = crypto.randomUUID()
      const idempotencyKey = crypto.randomUUID()

      // 1. Create order
      const orderRes = await createOrder({
        branchId,
        clientRequestId: clientReqId,
        type: orderType,
        tableId: orderType === 'dine_in' ? selectedTableId : null,
        customerId: matchedCustomer?.id || null,
        customerName: customerName || (orderType === 'dine_in' ? 'Dine-In Guest' : 'Takeaway Customer'),
        customerPhone,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
        notes: orderNotes,
        dealId: selectedDealId || null,
        dealDiscount,
        discount: manualDiscount,
        deliveryFee,
        items: cart.map((ci) => ({
          menu_item_id: ci.menuItem.id,
          quantity: ci.quantity,
          notes: ci.notes || null,
        })),
      })

      // 2. Settle payment
      await settlePayment({
        branchId,
        orderId: orderRes.id,
        method: paymentMethod,
        amount: total,
        idempotencyKey,
        cashSessionId: paymentMethod === 'cash' ? activeSessionId : null,
        providerRef: providerRef || null,
      })

      // Assemble full order object for immediate printable receipt & persistent dashboard analytics
      const receiptOrder: Order = {
        id: orderRes.id,
        branch_id: branchId,
        order_number: orderRes.order_number,
        business_date: getKarachiBusinessDate(),
        client_request_id: clientReqId,
        type: orderType,
        status: 'sent_to_kitchen',
        table_id: selectedTableId,
        customer_id: matchedCustomer?.id || null,
        customer_name: customerName || (orderType === 'dine_in' ? 'Dine-In Guest' : 'Takeaway Customer'),
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        rider_cash_collected: 0,
        rider_cash_handed_over: false,
        subtotal,
        deal_id: selectedDealId || null,
        deal_discount: dealDiscount,
        discount,
        tax,
        total,
        notes: orderNotes,
        created_by: profile?.full_name || 'Staff',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: cart.map((ci) => ({
          id: crypto.randomUUID(),
          order_id: orderRes.id,
          branch_id: branchId,
          menu_item_id: ci.menuItem.id,
          item_name: ci.menuItem.name,
          unit_price: ci.menuItem.price,
          quantity: ci.quantity,
          line_total: ci.menuItem.price * ci.quantity,
          notes: ci.notes,
        })),
        payments: [
          {
            id: crypto.randomUUID(),
            branch_id: branchId,
            order_id: orderRes.id,
            method: paymentMethod,
            status: 'succeeded',
            amount: total,
            idempotency_key: idempotencyKey,
            created_at: new Date().toISOString(),
          },
        ],
        table: tables.find((t) => t.id === selectedTableId),
      }

      // Persist to unified storage (triggers karachi_storage_update and karachi-pos-update)
      Storage.saveOrder(receiptOrder)
      if (orderType === 'dine_in' && selectedTableId) {
        Storage.updateTableStatus(selectedTableId, receiptOrder.id, 'preparing')
      }

      setPaymentModalOpen(false)
      setCompletedOrder(receiptOrder)

      // Clear cart
      setCart([])
      setSelectedDealId('')
      setDiscountAmount(0)
      setOrderNotes('')
      setCustomerName('')
      setCustomerPhone('')
      setDeliveryAddress('')
      setMatchedCustomer(null)
    } catch (err) {
      alert(`Order error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Direct Send-to-Kitchen (Hold Table / Bill later)
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const clientReqId = crypto.randomUUID()
      const orderRes = await createOrder({
        branchId,
        clientRequestId: clientReqId,
        type: orderType,
        tableId: orderType === 'dine_in' ? selectedTableId : null,
        customerId: matchedCustomer?.id || null,
        customerName: customerName || (orderType === 'dine_in' ? 'Dine-In Guest' : 'Takeaway Customer'),
        customerPhone,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
        notes: orderNotes,
        dealId: selectedDealId || null,
        dealDiscount,
        discount: manualDiscount,
        deliveryFee,
        items: cart.map((ci) => ({
          menu_item_id: ci.menuItem.id,
          quantity: ci.quantity,
          notes: ci.notes || null,
        })),
      })

      const kitchenOrder: Order = {
        id: orderRes.id,
        branch_id: branchId,
        order_number: orderRes.order_number,
        business_date: getKarachiBusinessDate(),
        client_request_id: clientReqId,
        type: orderType,
        status: 'sent_to_kitchen',
        table_id: selectedTableId,
        customer_id: matchedCustomer?.id || null,
        customer_name: customerName || (orderType === 'dine_in' ? 'Dine-In Guest' : 'Takeaway Customer'),
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        rider_cash_collected: 0,
        rider_cash_handed_over: false,
        subtotal,
        deal_id: selectedDealId || null,
        deal_discount: dealDiscount,
        discount,
        tax,
        total,
        notes: orderNotes,
        created_by: profile?.full_name || 'Staff',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: cart.map((ci) => ({
          id: crypto.randomUUID(),
          order_id: orderRes.id,
          branch_id: branchId,
          menu_item_id: ci.menuItem.id,
          item_name: ci.menuItem.name,
          unit_price: ci.menuItem.price,
          quantity: ci.quantity,
          line_total: ci.menuItem.price * ci.quantity,
          notes: ci.notes,
        })),
        payments: [],
        table: tables.find((t) => t.id === selectedTableId),
      }

      Storage.saveOrder(kitchenOrder)
      if (orderType === 'dine_in' && selectedTableId) {
        Storage.updateTableStatus(selectedTableId, kitchenOrder.id, 'preparing')
      }

      setCompletedOrder(kitchenOrder)
      setCart([])
      setSelectedDealId('')
      setDiscountAmount(0)
      setOrderNotes('')
      setCustomerName('')
      setCustomerPhone('')
      setMatchedCustomer(null)
    } catch (err) {
      alert(`Order error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        subtitle="Fast counter, dine-in and delivery order creation"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {queueCount > 0 && (
              <Badge tone="warn">
                {queueCount} offline orders queued{' '}
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={handleSyncQueue}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
              </Badge>
            )}
            <Badge tone={activeSessionId ? 'ok' : 'warn'}>
              Till: {activeSessionId ? 'ACTIVE' : 'NO CASH SESSION'}
            </Badge>
          </div>
        }
      />

      {loading && <LoadingState label="Loading Karachi Express POS menu & tables…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && (
        <div className="pos-layout">
          {/* Left Column: Menu & Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            {/* Search & Category Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="search"
                className="input"
                placeholder="Search Biryani, Karahi, Tikka, Naan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '220px' }}
              />

              <div className="pos-cat-tabs">
                <button
                  className={`btn btn--sm ${selectedCat === 'all' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedCat('all')}
                >
                  All Items
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={`btn btn--sm ${selectedCat === c.id ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    onClick={() => setSelectedCat(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="menu-grid">
              {filteredItems.map((item) => (
                <DishCard key={item.id} item={item} onAdd={addToCart} />
              ))}
            </div>
          </div>

          {/* Right Column: Order Cart & Config (Sticky on desktop) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', position: 'sticky', top: '16px' }}>
            <Card title="Order Details">
              {/* Order Type Selector */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'var(--w-200)', borderRadius: 'var(--radius)', padding: '2px' }}>
                <button
                  className={`btn btn--sm ${orderType === 'dine_in' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setOrderType('dine_in')}
                >
                  🍽️ Dine-In
                </button>
                <button
                  className={`btn btn--sm ${orderType === 'takeaway' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setOrderType('takeaway')}
                >
                  🛍️ Takeaway
                </button>
                <button
                  className={`btn btn--sm ${orderType === 'delivery' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setOrderType('delivery')}
                >
                  🛵 Delivery
                </button>
              </div>

              {/* Dine-In Table Picker */}
              {orderType === 'dine_in' && (
                <div style={{ marginBottom: '12px' }}>
                  <label className="field__label">Select Dining Table:</label>
                  <select
                    className="input"
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.seats} seats) {t.current_order_id ? '— [OCCUPIED]' : '— [FREE]'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Details & CRM Lookup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <Field
                  id="phone"
                  label="Customer Phone (03xx-xxxxxxx)"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Enter phone to auto-lookup customer"
                />
                <Field
                  id="name"
                  label="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Guest name (optional for dine-in)"
                />
                {matchedCustomer && (
                  <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>👤 <strong>{matchedCustomer.name}</strong> ({matchedCustomer.total_orders} orders · Spent: {formatPKR(matchedCustomer.total_spent)})</span>
                    <Badge tone={matchedCustomer.marketing_consent === 'opted_in' ? 'ok' : 'neutral'}>
                      {matchedCustomer.marketing_consent === 'opted_in' ? '🔔 Opted-In' : 'Standard'}
                    </Badge>
                  </div>
                )}
                {orderType === 'delivery' && (
                  <Field
                    id="address"
                    label="Delivery Address in Karachi"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="e.g. House 45, Street 10, Clifton Block 4"
                  />
                )}
              </div>

              {/* Cart Items List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 0', margin: '8px 0' }}>
                {cart.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                    Cart is empty. Select items from the menu.
                  </p>
                ) : (
                  cart.map((ci) => (
                    <div key={ci.menuItem.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{ci.menuItem.name}</span>
                        <span className="num" style={{ fontWeight: 600 }}>{formatPKR(ci.menuItem.price * ci.quantity)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className="btn btn--sm" style={{ padding: '0 8px', minHeight: '28px' }} onClick={() => updateQuantity(ci.menuItem.id, -1)}>
                            -
                          </button>
                          <span className="num" style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{ci.quantity}</span>
                          <button className="btn btn--sm" style={{ padding: '0 8px', minHeight: '28px' }} onClick={() => updateQuantity(ci.menuItem.id, 1)}>
                            +
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Note (e.g. spicy, raita)"
                          value={ci.notes}
                          onChange={(e) => updateItemNotes(ci.menuItem.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '2px 6px', width: '150px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)' }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Deals & Promotions Selector */}
              <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius)', background: 'var(--surface-muted)', margin: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="field__label" style={{ margin: 0, fontWeight: 600 }}>🏷️ Apply Deal / Promotion</label>
                  {selectedDeal && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                      onClick={() => setSelectedDealId('')}
                    >
                      Clear Deal
                    </button>
                  )}
                </div>

                <select
                  className="input"
                  value={selectedDealId}
                  onChange={(e) => setSelectedDealId(e.target.value)}
                  style={{ width: '100%', fontSize: 'var(--fs-sm)' }}
                >
                  <option value="">No Deal Applied (Standard Pricing)</option>
                  {activeDeals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.deal_type.toUpperCase().replace('_', ' ')})
                    </option>
                  ))}
                </select>

                {selectedDeal && (
                  <div style={{ marginTop: '6px' }}>
                    {dealEligibility.isEligible ? (
                      <div style={{ background: 'var(--ok-bg, #dcefe4)', color: 'var(--ok, #2f7d57)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: '12px' }}>
                        ✅ {dealEligibility.summary} (Saves {formatPKR(dealDiscount)})
                      </div>
                    ) : (
                      <div style={{ background: 'var(--warn-bg, #fef3c7)', color: 'var(--warn-text, #92400e)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: '12px' }}>
                        ⚠️ Ineligible: {dealEligibility.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Notes & Manual Discount */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Order special instructions..."
                  className="input"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  style={{ flex: 1, fontSize: 'var(--fs-sm)' }}
                />
                <input
                  type="number"
                  placeholder="Manual Disc. Rs."
                  className="input num"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: '125px', fontSize: 'var(--fs-sm)' }}
                  title="Manual staff discount override"
                />
              </div>

              {/* Totals Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--fs-sm)', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span className="num">{formatPKR(subtotal)}</span>
                </div>
                {dealDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ok, #2f7d57)' }}>
                    <span>🏷️ Deal Discount ({selectedDeal?.name}):</span>
                    <span className="num">-{formatPKR(dealDiscount)}</span>
                  </div>
                )}
                {manualDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Manual Discount:</span>
                    <span className="num">-{formatPKR(manualDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sindh Sales Tax (13%):</span>
                  <span className="num">{formatPKR(tax)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Delivery Fee:</span>
                    <span className="num">{formatPKR(deliveryFee)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-lg)', fontWeight: 700, borderTop: '2px solid var(--c-800)', paddingTop: '6px', marginTop: '4px' }}>
                  <span>TOTAL:</span>
                  <span className="num" style={{ color: 'var(--amber-600)' }}>{formatPKR(total)}</span>
                </div>
              </div>

              {/* Checkout Action Buttons */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button
                  variant="primary"
                  style={{ width: '100%', height: '46px', fontSize: 'var(--fs-sm)' }}
                  disabled={cart.length === 0 || submitting}
                  onClick={handleProceedToPayment}
                >
                  💳 Pay & Send to Kitchen ({formatPKR(total)})
                </Button>
                <Button
                  variant="ghost"
                  style={{ width: '100%', height: '38px', fontSize: '12px', border: '1px solid var(--border)' }}
                  disabled={cart.length === 0 || submitting}
                  onClick={handleSendToKitchen}
                >
                  🍳 Send to Kitchen (Hold Bill)
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {paymentModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2 style={{ marginBottom: '12px' }}>Settle Bill: {formatPKR(total)}</h2>

            {/* Payment Method Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '16px' }}>
              {(['cash', 'card', 'jazzcash', 'easypaisa'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  className={`btn btn--sm ${paymentMethod === m ? 'btn--accent' : 'btn--ghost'}`}
                  onClick={() => setPaymentMethod(m)}
                  style={{ textTransform: 'uppercase' }}
                >
                  {m}
                </button>
              ))}
            </div>

            {paymentMethod === 'cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <Field
                  id="tender"
                  label="Cash Tendered (Rs.)"
                  type="number"
                  value={tenderAmount}
                  onChange={(e) => setTenderAmount(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)' }}>
                  <span>Change to Return:</span>
                  <strong className="num" style={{ fontSize: 'var(--fs-lg)', color: 'var(--ok)' }}>
                    {formatPKR(changeDue)}
                  </strong>
                </div>
              </div>
            )}

            {(paymentMethod === 'card' || paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa') && (
              <div style={{ marginBottom: '16px' }}>
                <Field
                  id="ref"
                  label="Transaction / Approval ID"
                  placeholder="e.g. TXN-982144 or POS Slip No."
                  value={providerRef}
                  onChange={(e) => setProviderRef(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={submitting} onClick={handleCompleteOrder}>
                Confirm Payment & Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {completedOrder && (
        <ReceiptModal order={completedOrder} onClose={() => setCompletedOrder(null)} />
      )}
    </div>
  )
}
