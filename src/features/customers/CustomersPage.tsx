import { useEffect, useState, useCallback, useDeferredValue } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { formatPakistaniPhone, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phoneNormalizer'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchCustomersList,
  createCustomerRecord,
  fetchCustomerOrderHistory,
  fetchCustomerReservationHistory,
  updateCustomerConsent,
} from './api'
import type { Customer, Order, TableReservation, MarketingConsent } from '@/types/domain'

export function CustomersPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [search, setSearch] = useState('')
  const [consentFilter, setConsentFilter] = useState<MarketingConsent | 'all'>('all')
  const deferredSearch = useDeferredValue(search)

  // Add / Edit Customer Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formConsent, setFormConsent] = useState<MarketingConsent>('unspecified')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Customer Profile & History Modal
  const [activeCust, setActiveCust] = useState<Customer | null>(null)
  const [profileTab, setProfileTab] = useState<'orders' | 'reservations'>('orders')
  const [custOrders, setCustOrders] = useState<Order[]>([])
  const [custReservations, setCustReservations] = useState<TableReservation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [updatingConsent, setUpdatingConsent] = useState(false)

  // Export Audience Modal
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCustomersList(branchId, deferredSearch, consentFilter)
      setCustomers(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, deferredSearch, consentFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormAddress('')
    setFormNotes('')
    setFormConsent('unspecified')
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (cust: Customer) => {
    setEditingId(cust.id)
    setFormName(cust.name)
    setFormPhone(cust.phone)
    setFormEmail(cust.email || '')
    setFormAddress(cust.address || '')
    setFormNotes(cust.notes || '')
    setFormConsent(cust.marketing_consent || 'unspecified')
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleSaveCustomer = async () => {
    const errors: { name?: string; phone?: string } = {}
    if (!formName.trim()) errors.name = 'Customer full name is required'
    if (!formPhone.trim()) {
      errors.phone = 'Phone number is required'
    } else if (!isValidPhoneNumber(formPhone)) {
      errors.phone = 'Please enter a valid Pakistani phone number (e.g. 0300-1234567)'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const saved = await createCustomerRecord(branchId, {
        id: editingId || undefined,
        name: formName.trim(),
        phone: normalizePhoneNumber(formPhone.trim()),
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        notes: formNotes.trim() || null,
        marketing_consent: formConsent,
        marketing_consent_source: editingId ? 'staff_edit' : 'direct',
      })
      setModalOpen(false)
      setSuccessMsg(`Customer "${saved.name}" (${formatPakistaniPhone(saved.phone)}) saved successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Customer error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenProfile = async (cust: Customer) => {
    setActiveCust(cust)
    setProfileTab('orders')
    setHistoryLoading(true)
    try {
      const [orders, resList] = await Promise.all([
        fetchCustomerOrderHistory(branchId, cust.phone),
        fetchCustomerReservationHistory(branchId, cust.id || cust.phone),
      ])
      setCustOrders(orders)
      setCustReservations(resList)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleChangeConsent = async (customerId: string, newConsent: MarketingConsent) => {
    setUpdatingConsent(true)
    try {
      await updateCustomerConsent(branchId, customerId, newConsent, 'staff_toggle')
      if (activeCust && activeCust.id === customerId) {
        setActiveCust({
          ...activeCust,
          marketing_consent: newConsent,
          marketing_consent_at: new Date().toISOString(),
          marketing_consent_source: 'staff_toggle',
        })
      }
      setSuccessMsg(`Marketing consent updated to ${newConsent.toUpperCase()}`)
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadData()
    } catch (err) {
      alert(`Consent update failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUpdatingConsent(false)
    }
  }

  const optedInCustomers = customers.filter((c) => c.marketing_consent === 'opted_in')

  const handleCopyAudience = () => {
    const list = optedInCustomers
      .map((c) => `${c.name}, ${formatPakistaniPhone(c.phone)}, Lifetime Spend: PKR ${c.total_spent}`)
      .join('\n')
    navigator.clipboard.writeText(list)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 3000)
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer & Contact',
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>{r.name}</strong>
            {r.total_orders >= 5 && <Badge tone="warn">VIP</Badge>}
          </div>
          <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
            📞 {formatPakistaniPhone(r.phone)}
          </span>
          {r.email && (
            <span className="muted" style={{ display: 'block', fontSize: '11px' }}>
              ✉️ {r.email}
            </span>
          )}
          {r.notes && (
            <span className="muted" style={{ display: 'block', fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
              Note: {r.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'consent',
      header: 'Marketing Consent',
      render: (r) => {
        const consent = r.marketing_consent || 'unspecified'
        if (consent === 'opted_in') {
          return (
            <div>
              <Badge tone="ok">🔔 Opted-In</Badge>
              <span className="muted" style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>
                Promos permitted
              </span>
            </div>
          )
        }
        if (consent === 'opted_out') {
          return (
            <div>
              <Badge tone="danger">🔕 Opted-Out</Badge>
              <span className="muted" style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>
                Do NOT message
              </span>
            </div>
          )
        }
        return (
          <div>
            <Badge tone="neutral">Unspecified</Badge>
            <span className="muted" style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>
              Operational only
            </span>
          </div>
        )
      },
    },
    {
      key: 'last_visit',
      header: 'Last Activity',
      render: (r) => {
        if (!r.last_visit_at) return <span className="muted">—</span>
        const d = new Date(r.last_visit_at)
        return (
          <div>
            <strong>{d.toLocaleDateString('en-GB')}</strong>
            <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      },
    },
    {
      key: 'orders',
      header: 'Completed Orders',
      numeric: true,
      render: (r) => <Badge tone="neutral">{r.total_orders} orders</Badge>,
    },
    {
      key: 'spent',
      header: 'Authoritative Spend',
      numeric: true,
      render: (r) => <strong className="num">{formatPKR(r.total_spent)}</strong>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button size="sm" variant="accent" onClick={() => handleOpenProfile(r)}>
            👤 Profile
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEditModal(r)}>
            ✏️ Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Customer CRM & Guest Profiles"
        subtitle="Automatic customer profiles, reservation history, authoritative lifetime spend, and consent management"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setExportModalOpen(true)}>
              📤 Marketing Audience ({optedInCustomers.length})
            </Button>
            <Button variant="primary" onClick={openAddModal}>
              + Add Customer
            </Button>
          </div>
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

      {/* Filter and Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <Card>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            className="input"
            placeholder="Search by customer name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            style={{ flex: 1, minWidth: '220px' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Consent:</span>
            <select
              className="input"
              value={consentFilter}
              onChange={(e) => setConsentFilter(e.target.value as MarketingConsent | 'all')}
              style={{ padding: '6px 10px' }}
            >
              <option value="all">All Profiles</option>
              <option value="opted_in">🔔 Opted-In Only (Marketing Audience)</option>
              <option value="opted_out">🔕 Opted-Out</option>
              <option value="unspecified">Unspecified Consent</option>
            </select>
          </div>

          <Button variant="ghost" onClick={loadData}>
            Refresh
          </Button>
        </div>
      </Card>
      </div>

      <Card>
        {loading && <LoadingState label="Searching customer directory…" />}
        {error && <ErrorState error={error} onRetry={loadData} />}

        {!loading && !error && customers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <span style={{ fontSize: '36px' }}>👤</span>
            <h3 style={{ marginTop: '8px' }}>No Customers Found</h3>
            <p className="muted">
              {search || consentFilter !== 'all'
                ? 'Try adjusting your search criteria or consent filter.'
                : 'Customer profiles will appear automatically when reservations or POS orders are placed.'}
            </p>
          </div>
        )}

        {!loading && !error && customers.length > 0 && (
          <DataTable columns={columns} rows={customers} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Add / Edit Customer Profile Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <h2>{editingId ? 'Edit Customer Profile' : 'Add New Customer Profile'}</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Maintain accurate contact information and marketing preferences for restaurant operations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <Field
                  id="cname"
                  label="Full Name *"
                  placeholder="e.g. Tariq Mehmood"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value)
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                />
                {fieldErrors.name && (
                  <span style={{ color: 'var(--danger)', fontSize: 'var(--fs-xs)', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              <div>
                <Field
                  id="cphone"
                  label="Phone Number (Pakistani Format: 03xx-xxxxxxx) *"
                  placeholder="0300-1234567"
                  value={formPhone}
                  onChange={(e) => {
                    setFormPhone(e.target.value)
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }))
                  }}
                />
                {fieldErrors.phone && (
                  <span style={{ color: 'var(--danger)', fontSize: 'var(--fs-xs)', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.phone}
                  </span>
                )}
              </div>

              <Field
                id="cemail"
                label="Email Address (Optional)"
                placeholder="customer@domain.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />

              <Field
                id="caddr"
                label="Delivery Address in Karachi (Optional)"
                placeholder="e.g. Bungalow 14, 26th Street, Phase 5 DHA"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />

              <Field
                id="cnotes"
                label="Preferences & Dietary Notes (Optional)"
                placeholder="e.g. Prefers low spice, extra raita with Karahi"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />

              <div style={{ border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius)', background: 'var(--surface-muted)' }}>
                <label className="field__label" style={{ marginBottom: '6px' }}>Marketing & Promotional Consent</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                    <input
                      type="radio"
                      name="mconsent"
                      value="opted_in"
                      checked={formConsent === 'opted_in'}
                      onChange={() => setFormConsent('opted_in')}
                    />
                    <span>🔔 <strong>Opted-In</strong> — Guest agreed to receive combo deals and discount offers</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                    <input
                      type="radio"
                      name="mconsent"
                      value="opted_out"
                      checked={formConsent === 'opted_out'}
                      onChange={() => setFormConsent('opted_out')}
                    />
                    <span>🔕 <strong>Opted-Out</strong> — Guest explicitly requested NO promotional messages</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                    <input
                      type="radio"
                      name="mconsent"
                      value="unspecified"
                      checked={formConsent === 'unspecified'}
                      onChange={() => setFormConsent('unspecified')}
                    />
                    <span>⚪ <strong>Unspecified</strong> — Operational communications only</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={handleSaveCustomer}
                  disabled={!formName.trim() || !formPhone.trim()}
                >
                  {editingId ? 'Update Customer' : 'Save Customer Profile'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer 360 CRM Profile Modal */}
      {activeCust && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2>{activeCust.name}</h2>
                <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  Phone: <strong>{formatPakistaniPhone(activeCust.phone)}</strong>
                  {activeCust.email ? ` · ${activeCust.email}` : ''}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setActiveCust(null)}>
                ✕ Close
              </Button>
            </div>

            {/* Quick Metrics Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                marginBottom: '16px',
                background: 'var(--surface-muted)',
                padding: '12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <span className="muted" style={{ fontSize: '11px' }}>LIFETIME SPEND</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>
                  {formatPKR(activeCust.total_spent)}
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '11px' }}>COMPLETED ORDERS</span>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {activeCust.total_orders}
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '11px' }}>LAST ACTIVITY</span>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {activeCust.last_visit_at ? new Date(activeCust.last_visit_at).toLocaleDateString('en-GB') : '—'}
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: '11px' }}>CUSTOMER SINCE</span>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {new Date(activeCust.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>

            {/* Marketing Consent Box */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px',
                marginBottom: '16px',
                background: activeCust.marketing_consent === 'opted_in' ? 'var(--ok-bg, #f0fdf4)' : 'var(--surface-muted)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong>Marketing Consent Status: </strong>
                  {activeCust.marketing_consent === 'opted_in' && <Badge tone="ok">🔔 Opted-In</Badge>}
                  {activeCust.marketing_consent === 'opted_out' && <Badge tone="danger">🔕 Opted-Out</Badge>}
                  {(!activeCust.marketing_consent || activeCust.marketing_consent === 'unspecified') && (
                    <Badge tone="neutral">Unspecified</Badge>
                  )}
                  {activeCust.marketing_consent_source && (
                    <span className="muted" style={{ fontSize: '11px', marginLeft: '6px' }}>
                      (Source: {activeCust.marketing_consent_source})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeCust.marketing_consent !== 'opted_in' && (
                    <Button
                      size="sm"
                      variant="accent"
                      loading={updatingConsent}
                      onClick={() => handleChangeConsent(activeCust.id, 'opted_in')}
                    >
                      🔔 Opt-In
                    </Button>
                  )}
                  {activeCust.marketing_consent !== 'opted_out' && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={updatingConsent}
                      onClick={() => handleChangeConsent(activeCust.id, 'opted_out')}
                    >
                      🔕 Opt-Out
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Tabs: Completed Orders vs Reservations */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
              <button
                type="button"
                className={`btn ${profileTab === 'orders' ? 'btn--primary' : 'btn--ghost'}`}
                style={{ borderRadius: 'var(--radius) var(--radius) 0 0', borderBottom: 'none' }}
                onClick={() => setProfileTab('orders')}
              >
                📜 Completed Orders ({custOrders.length})
              </button>
              <button
                type="button"
                className={`btn ${profileTab === 'reservations' ? 'btn--primary' : 'btn--ghost'}`}
                style={{ borderRadius: 'var(--radius) var(--radius) 0 0', borderBottom: 'none' }}
                onClick={() => setProfileTab('reservations')}
              >
                🗓️ Table Bookings ({custReservations.length})
              </button>
            </div>

            {historyLoading && <LoadingState label="Loading guest history…" />}

            {!historyLoading && profileTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {custOrders.length === 0 ? (
                  <p className="muted" style={{ padding: '16px', textAlign: 'center' }}>
                    No completed orders on record for this phone number.
                  </p>
                ) : (
                  custOrders.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--surface-muted)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <strong>Order #{o.order_number}</strong> ({o.type.toUpperCase()})
                        <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                          {new Date(o.created_at).toLocaleString('en-GB')}
                        </span>
                        {o.deal_discount && o.deal_discount > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--ok, #2f7d57)', display: 'block' }}>
                            🏷️ Deal Applied: -{formatPKR(o.deal_discount)}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong className="num">{formatPKR(o.total)}</strong>
                        <div>
                          <Badge tone={o.status === 'completed' ? 'ok' : o.status === 'cancelled' ? 'danger' : 'warn'}>
                            {o.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!historyLoading && profileTab === 'reservations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {custReservations.length === 0 ? (
                  <p className="muted" style={{ padding: '16px', textAlign: 'center' }}>
                    No table bookings or reservations recorded.
                  </p>
                ) : (
                  custReservations.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--surface-muted)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <strong>{new Date(r.reservation_time).toLocaleString('en-GB')}</strong>
                        <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                          Table: {r.table?.label || 'Assigned'} · Party: {r.guest_count} persons
                        </span>
                        {r.notes && (
                          <span className="muted" style={{ display: 'block', fontSize: '11px', fontStyle: 'italic' }}>
                            {r.notes}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge tone={r.status === 'confirmed' ? 'ok' : r.status === 'seated' ? 'warn' : 'neutral'}>
                          {r.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="primary" onClick={() => setActiveCust(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Marketing Audience Modal */}
      {exportModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2>Export Marketing Audience</h2>
            <div
              style={{
                background: 'var(--ok-bg, #dcefe4)',
                color: 'var(--ok, #2f7d57)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                margin: '12px 0',
                fontSize: 'var(--fs-sm)',
              }}
            >
              ✅ Filtered to <strong>{optedInCustomers.length}</strong> customer profiles who explicitly opted in.
              Customers who opted out or have unspecified consent are excluded to respect privacy regulations.
            </div>

            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                background: 'var(--surface-muted)',
                padding: '12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {optedInCustomers.length === 0
                ? 'No customers have opted in to promotional messaging yet.'
                : optedInCustomers
                    .map((c) => `${c.name} | ${formatPakistaniPhone(c.phone)} | Spent: PKR ${c.total_spent}`)
                    .join('\n')}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setExportModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                disabled={optedInCustomers.length === 0}
                onClick={handleCopyAudience}
              >
                {copySuccess ? '✅ Copied to Clipboard!' : '📋 Copy Audience List'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
