import { useEffect, useState, useCallback, useMemo } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchDealsList,
  saveDealRecord,
  toggleDealStatus,
  deleteDealRecord,
  fetchMenuItemsForDeals,
} from './api'
import type { Deal, DealType, DiscountType, OrderType, MenuItem } from '@/types/domain'

export function DealsPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [deals, setDeals] = useState<Deal[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dealType, setDealType] = useState<DealType>('combo')
  const [discountType, setDiscountType] = useState<DiscountType>('combo_price')
  const [discountValue, setDiscountValue] = useState(100)
  const [comboPrice, setComboPrice] = useState<number | null>(550)
  const [minOrderAmount, setMinOrderAmount] = useState<number | null>(0)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | null>(null)
  const [selectedOrderTypes, setSelectedOrderTypes] = useState<OrderType[]>(['dine_in', 'takeaway', 'delivery'])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [isStackable, setIsStackable] = useState(false)
  const [redemptionLimit, setRedemptionLimit] = useState<number | null>(null)
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [comboItem1, setComboItem1] = useState('')
  const [comboItem2, setComboItem2] = useState('')
  const [bogoItem, setBogoItem] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dealData, itemsData] = await Promise.all([
        fetchDealsList(branchId),
        fetchMenuItemsForDeals(branchId),
      ])
      setDeals(dealData)
      setMenuItems(itemsData)
      if (itemsData.length >= 2) {
        if (!comboItem1) setComboItem1(itemsData[0].id)
        if (!comboItem2) setComboItem2(itemsData[1].id)
        if (!bogoItem) setBogoItem(itemsData[0].id)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, comboItem1, comboItem2, bogoItem])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateModal = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setDealType('combo')
    setDiscountType('combo_price')
    setDiscountValue(110)
    setComboPrice(550)
    setMinOrderAmount(0)
    setMaxDiscountAmount(null)
    setSelectedOrderTypes(['dine_in', 'takeaway', 'delivery'])
    setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6])
    setIsStackable(false)
    setRedemptionLimit(null)
    setPerCustomerLimit(null)
    setInternalNotes('')
    if (menuItems.length >= 2) {
      setComboItem1(menuItems[0].id)
      setComboItem2(menuItems[1].id)
      setBogoItem(menuItems[0].id)
    }
    setModalOpen(true)
  }

  const openEditModal = (d: Deal) => {
    setEditingId(d.id)
    setName(d.name)
    setDescription(d.description || '')
    setDealType(d.deal_type)
    setDiscountType(d.discount_type)
    setDiscountValue(d.discount_value)
    setComboPrice(d.combo_price ?? null)
    setMinOrderAmount(d.min_order_amount ?? 0)
    setMaxDiscountAmount(d.max_discount_amount ?? null)
    setSelectedOrderTypes(d.applicable_order_types || ['dine_in', 'takeaway', 'delivery'])
    setSelectedWeekdays(d.applicable_weekdays || [0, 1, 2, 3, 4, 5, 6])
    setIsStackable(d.is_stackable)
    setRedemptionLimit(d.redemption_limit ?? null)
    setPerCustomerLimit(d.per_customer_limit ?? null)
    setInternalNotes(d.internal_notes || '')

    if (d.items && d.items.length >= 1) {
      setComboItem1(d.items[0]?.menu_item_id || '')
      setComboItem2(d.items[1]?.menu_item_id || '')
      setBogoItem(d.items[0]?.menu_item_id || '')
    }
    setModalOpen(true)
  }

  const handleSaveDeal = async () => {
    if (!name.trim()) {
      alert('Please enter a promotion / deal name.')
      return
    }

    setSubmitting(true)
    try {
      let finalDiscountType: DiscountType = discountType
      let finalDiscountVal = Number(discountValue) || 0
      let itemsPayload: Deal['items'] = []

      if (dealType === 'combo') {
        finalDiscountType = 'combo_price'
        const itemA = menuItems.find((m) => m.id === comboItem1)
        const itemB = menuItems.find((m) => m.id === comboItem2)
        const origTotal = (itemA?.price || 0) + (itemB?.price || 0)
        finalDiscountVal = Math.max(0, origTotal - (Number(comboPrice) || 0))
        itemsPayload = [
          {
            id: 'di-' + Date.now() + '-1',
            deal_id: editingId || '',
            menu_item_id: comboItem1,
            required_quantity: 1,
            is_free: false,
          },
          {
            id: 'di-' + Date.now() + '-2',
            deal_id: editingId || '',
            menu_item_id: comboItem2,
            required_quantity: 1,
            is_free: false,
          },
        ]
      } else if (dealType === 'bogo') {
        finalDiscountType = 'free_item'
        const target = menuItems.find((m) => m.id === bogoItem)
        finalDiscountVal = target?.price || 0
        itemsPayload = [
          {
            id: 'di-' + Date.now() + '-bogo',
            deal_id: editingId || '',
            menu_item_id: bogoItem,
            required_quantity: 2,
            is_free: true,
          },
        ]
      } else if (dealType === 'flat_discount') {
        finalDiscountType = 'fixed'
      } else if (dealType === 'percentage_discount') {
        finalDiscountType = 'percentage'
      }

      await saveDealRecord(branchId, {
        id: editingId || undefined,
        name: name.trim(),
        description: description.trim() || null,
        deal_type: dealType,
        discount_type: finalDiscountType,
        discount_value: finalDiscountVal,
        combo_price: dealType === 'combo' ? Number(comboPrice) : null,
        min_order_amount: minOrderAmount ? Number(minOrderAmount) : 0,
        max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        applicable_order_types: selectedOrderTypes,
        applicable_weekdays: selectedWeekdays,
        is_active: true,
        is_stackable: isStackable,
        redemption_limit: redemptionLimit ? Number(redemptionLimit) : null,
        per_customer_limit: perCustomerLimit ? Number(perCustomerLimit) : null,
        internal_notes: internalNotes.trim() || null,
        items: itemsPayload,
      })

      setModalOpen(false)
      setSuccessMsg(`Deal "${name}" successfully saved and activated!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Error saving deal: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (deal: Deal) => {
    try {
      await toggleDealStatus(deal.id, !deal.is_active)
      setSuccessMsg(`Deal "${deal.name}" marked as ${!deal.is_active ? 'ACTIVE' : 'INACTIVE'}`)
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadData()
    } catch (err) {
      alert(`Toggle failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDeleteDeal = async (deal: Deal) => {
    if (!confirm(`Are you sure you want to delete "${deal.name}"? Past order receipts will safely preserve historical discounts.`)) {
      return
    }
    try {
      await deleteDealRecord(deal.id)
      setSuccessMsg(`Deal "${deal.name}" deleted.`)
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadData()
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (statusFilter === 'active' && !d.is_active) return false
      if (statusFilter === 'inactive' && d.is_active) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = d.name.toLowerCase().includes(q)
        const matchDesc = (d.description || '').toLowerCase().includes(q)
        return matchName || matchDesc
      }
      return true
    })
  }, [deals, statusFilter, search])

  // Summary KPIs
  const activeCount = deals.filter((d) => d.is_active).length
  const totalRedemptions = deals.reduce((acc, d) => acc + (d.times_redeemed || 0), 0)
  const totalDiscountGranted = deals.reduce((acc, d) => acc + (d.times_redeemed || 0) * (d.discount_value || 0), 0)

  const columns: Column<Deal>[] = [
    {
      key: 'name',
      header: 'Deal & Promotion',
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>{r.name}</strong>
            <Badge tone={r.deal_type === 'combo' ? 'info' : r.deal_type === 'bogo' ? 'warn' : 'ok'}>
              {r.deal_type.toUpperCase().replace('_', ' ')}
            </Badge>
          </div>
          {r.description && (
            <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>
              {r.description}
            </span>
          )}
          {r.min_order_amount && r.min_order_amount > 0 ? (
            <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
              Min. Order: {formatPKR(r.min_order_amount)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Discount / Deal Price',
      render: (r) => {
        if (r.deal_type === 'combo') {
          return (
            <div>
              <strong className="num" style={{ color: 'var(--primary)' }}>
                {formatPKR(r.combo_price || 0)}
              </strong>
              <span className="muted" style={{ display: 'block', fontSize: '11px' }}>
                Saves {formatPKR(r.discount_value)}
              </span>
            </div>
          )
        }
        if (r.discount_type === 'percentage') {
          return (
            <div>
              <strong className="num">{r.discount_value}% OFF</strong>
              {r.max_discount_amount && (
                <span className="muted" style={{ display: 'block', fontSize: '11px' }}>
                  Max: {formatPKR(r.max_discount_amount)}
                </span>
              )}
            </div>
          )
        }
        if (r.deal_type === 'bogo') {
          return (
            <div>
              <strong style={{ color: 'var(--warn-text, #b45309)' }}>BOGO FREE</strong>
              <span className="muted" style={{ display: 'block', fontSize: '11px' }}>
                Value: {formatPKR(r.discount_value)}
              </span>
            </div>
          )
        }
        return <strong className="num">-{formatPKR(r.discount_value)}</strong>
      },
    },
    {
      key: 'schedule',
      header: 'Applicable On',
      render: (r) => {
        const types = (r.applicable_order_types || []).map((t) => t.toUpperCase()).join(', ')
        return (
          <div>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{types || 'ALL ORDERS'}</span>
            <span className="muted" style={{ display: 'block', fontSize: '11px' }}>
              {r.applicable_weekdays && r.applicable_weekdays.length === 7 ? 'All Weekdays' : 'Selected Days'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'redemptions',
      header: 'Usage Count',
      numeric: true,
      render: (r) => (
        <div>
          <strong className="num">{r.times_redeemed || 0}</strong>
          {r.redemption_limit && (
            <span className="muted" style={{ display: 'block', fontSize: '10px' }}>
              of {r.redemption_limit} limit
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <button
          type="button"
          onClick={() => handleToggleActive(r)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          title="Click to toggle status"
        >
          {r.is_active ? <Badge tone="ok">ACTIVE</Badge> : <Badge tone="danger">INACTIVE</Badge>}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button size="sm" variant="ghost" onClick={() => openEditModal(r)}>
            ✏️ Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDeleteDeal(r)}>
            🗑️
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Deals & Promotions Management"
        subtitle="Manage Karachi meal combos, BOGO discounts, flat off vouchers, and order-level promotional rules"
        actions={
          <Button variant="primary" onClick={openCreateModal}>
            + Create New Deal
          </Button>
        }
      />

      {successMsg && (
        <div
          style={{
            background: 'var(--ok-bg, #dcefe4)',
            color: 'var(--ok, #2f7d57)',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500,
          }}
        >
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <Card>
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>ACTIVE DEALS</span>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
            {activeCount}
          </div>
          <span className="muted" style={{ fontSize: '11px' }}>Available on POS and Online</span>
        </Card>

        <Card>
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>TOTAL REDEMPTIONS</span>
          <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
            {totalRedemptions}
          </div>
          <span className="muted" style={{ fontSize: '11px' }}>Applied across all orders</span>
        </Card>

        <Card>
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>DISCOUNT GRANTED</span>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ok, #2f7d57)', marginTop: '4px' }}>
            {formatPKR(totalDiscountGranted)}
          </div>
          <span className="muted" style={{ fontSize: '11px' }}>Total promotional savings</span>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ marginBottom: '16px' }}>
        <Card>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="search"
              className="input"
              placeholder="Search promotions by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px' }}
            />

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn--sm ${statusFilter === 'all' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({deals.length})
              </button>
              <button
                type="button"
                className={`btn btn--sm ${statusFilter === 'active' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setStatusFilter('active')}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                className={`btn btn--sm ${statusFilter === 'inactive' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive ({deals.length - activeCount})
              </button>
            </div>

            <Button variant="ghost" onClick={loadData}>
              Refresh
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        {loading && <LoadingState label="Loading deals and promotions…" />}
        {error && <ErrorState error={error} onRetry={loadData} />}

        {!loading && !error && filteredDeals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <span style={{ fontSize: '36px' }}>🏷️</span>
            <h3 style={{ marginTop: '8px' }}>No Deals Found</h3>
            <p className="muted">
              {search ? 'No promotions match your search.' : 'Create your first combo deal or discount offer.'}
            </p>
            <Button variant="primary" style={{ marginTop: '12px' }} onClick={openCreateModal}>
              + Create New Deal
            </Button>
          </div>
        )}

        {!loading && !error && filteredDeals.length > 0 && (
          <DataTable columns={columns} rows={filteredDeals} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Create / Edit Deal Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>{editingId ? 'Edit Deal / Promotion' : 'Create New Deal or Promotion'}</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Configure combos, percentage discounts, minimum spend thresholds, and POS availability.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field
                id="dname"
                label="Promotion Name *"
                placeholder="e.g. Biryani & Mint Lemonade Duo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Field
                id="ddesc"
                label="Customer Description"
                placeholder="e.g. 1 Chicken Biryani + 1 Fresh Mint Lemonade at special combo price"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div>
                <label className="field__label">Deal Type</label>
                <select
                  className="input"
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="combo">🍱 Combo Deal (Fixed Bundle Price)</option>
                  <option value="bogo">🎁 Buy 1 Get 1 Free (BOGO)</option>
                  <option value="flat_discount">🏷️ Flat PKR Discount (e.g. Rs. 200 Off)</option>
                  <option value="percentage_discount">📊 Percentage Discount (e.g. 10% Off)</option>
                </select>
              </div>

              {/* Dynamic Inputs depending on Deal Type */}
              {dealType === 'combo' && (
                <div style={{ border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius)', background: 'var(--surface-muted)' }}>
                  <h4 style={{ marginBottom: '8px' }}>Combo Items & Special Price</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="field__label">Dish 1 (e.g. Main)</label>
                      <select
                        className="input"
                        value={comboItem1}
                        onChange={(e) => setComboItem1(e.target.value)}
                        style={{ width: '100%', marginTop: '4px' }}
                      >
                        {menuItems.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatPKR(m.price)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="field__label">Dish 2 (e.g. Drink / Side)</label>
                      <select
                        className="input"
                        value={comboItem2}
                        onChange={(e) => setComboItem2(e.target.value)}
                        style={{ width: '100%', marginTop: '4px' }}
                      >
                        {menuItems.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatPKR(m.price)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <Field
                      id="cprice"
                      label="Combo Bundle Price (PKR) *"
                      type="number"
                      min="0"
                      value={comboPrice ?? 550}
                      onChange={(e) => setComboPrice(Number(e.target.value))}
                    />
                    <span className="muted" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>
                      Customer pays this fixed bundle amount instead of original dish prices.
                    </span>
                  </div>
                </div>
              )}

              {dealType === 'bogo' && (
                <div style={{ border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius)', background: 'var(--surface-muted)' }}>
                  <h4 style={{ marginBottom: '8px' }}>BOGO Eligible Dish</h4>
                  <label className="field__label">Select Item (Requires 2 in cart, 1 is free)</label>
                  <select
                    className="input"
                    value={bogoItem}
                    onChange={(e) => setBogoItem(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({formatPKR(m.price)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dealType === 'flat_discount' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Field
                    id="fval"
                    label="Flat Discount Amount (PKR) *"
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                  <Field
                    id="fmin"
                    label="Minimum Order Subtotal (PKR)"
                    type="number"
                    min="0"
                    value={minOrderAmount ?? 0}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  />
                </div>
              )}

              {dealType === 'percentage_discount' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <Field
                    id="pval"
                    label="Discount % (1-100) *"
                    type="number"
                    min="1"
                    max="100"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                  <Field
                    id="pmin"
                    label="Min. Subtotal (PKR)"
                    type="number"
                    min="0"
                    value={minOrderAmount ?? 0}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  />
                  <Field
                    id="pmax"
                    label="Max Discount Cap (PKR)"
                    type="number"
                    placeholder="e.g. 600"
                    value={maxDiscountAmount ?? ''}
                    onChange={(e) => setMaxDiscountAmount(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}

              {/* Order Types Checkboxes */}
              <div>
                <label className="field__label">Applicable Order Types</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                  {(['dine_in', 'takeaway', 'delivery'] as OrderType[]).map((ot) => (
                    <label key={ot} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                      <input
                        type="checkbox"
                        checked={selectedOrderTypes.includes(ot)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderTypes([...selectedOrderTypes, ot])
                          } else {
                            setSelectedOrderTypes(selectedOrderTypes.filter((t) => t !== ot))
                          }
                        }}
                      />
                      <span>{ot.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Redemption Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field
                  id="rlimit"
                  label="Total Redemptions Limit (Optional)"
                  type="number"
                  placeholder="e.g. 500"
                  value={redemptionLimit ?? ''}
                  onChange={(e) => setRedemptionLimit(e.target.value ? Number(e.target.value) : null)}
                />
                <Field
                  id="pclimit"
                  label="Per-Customer Limit (Optional)"
                  type="number"
                  placeholder="e.g. 2"
                  value={perCustomerLimit ?? ''}
                  onChange={(e) => setPerCustomerLimit(e.target.value ? Number(e.target.value) : null)}
                />
              </div>

              {/* Stacking Rule */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                <input
                  type="checkbox"
                  checked={isStackable}
                  onChange={(e) => setIsStackable(e.target.checked)}
                />
                <span>Allow combining with other coupons or discounts (Default: False)</span>
              </label>

              <Field
                id="notes"
                label="Internal Operations Notes"
                placeholder="e.g. Launched for PSL season dinner traffic"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={submitting} onClick={handleSaveDeal}>
                  {editingId ? 'Update Deal' : 'Save & Activate Deal'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
