import { useEffect, useState, useCallback, useDeferredValue } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchCustomersList, createCustomerRecord, fetchCustomerOrderHistory } from './api'
import type { Customer, Order } from '@/types/domain'

export function CustomersPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [historyModalCust, setHistoryModalCust] = useState<Customer | null>(null)
  const [custOrders, setCustOrders] = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCustomersList(branchId, deferredSearch)
      setCustomers(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, deferredSearch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateCustomer = async () => {
    const errors: { name?: string; phone?: string } = {}
    if (!newName.trim()) errors.name = 'Customer full name is required'
    if (!newPhone.trim()) {
      errors.phone = 'Phone number is required'
    } else if (newPhone.trim().length < 8) {
      errors.phone = 'Please enter a valid phone number (min 8 digits)'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const saved = await createCustomerRecord(branchId, {
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || null,
        address: newAddress.trim() || null,
        notes: newNotes.trim() || null,
      })
      setAddModalOpen(false)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setNewAddress('')
      setNewNotes('')
      setSuccessMsg(`Customer "${saved.name}" (${saved.phone}) saved successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Customer error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewHistory = async (cust: Customer) => {
    setHistoryModalCust(cust)
    setHistoryLoading(true)
    try {
      const orders = await fetchCustomerOrderHistory(branchId, cust.phone)
      setCustOrders(orders)
    } finally {
      setHistoryLoading(false)
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      render: (r) => (
        <div>
          <strong>{r.name}</strong>
          {r.notes && <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>Note: {r.notes}</span>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone Contact',
      render: (r) => <strong>{r.phone}</strong>,
    },
    {
      key: 'address',
      header: 'Default Delivery Address',
      render: (r) => <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{r.address || '—'}</span>,
    },
    {
      key: 'orders',
      header: 'Orders',
      numeric: true,
      render: (r) => <Badge tone="neutral">{r.total_orders} orders</Badge>,
    },
    {
      key: 'spent',
      header: 'Lifetime Spend',
      numeric: true,
      render: (r) => <strong className="num">{formatPKR(r.total_spent)}</strong>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => handleViewHistory(r)}>
          📜 View Orders
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Customer Directory & CRM"
        subtitle="Guest profiles, delivery addresses, order counts, and lifetime value"
        actions={
          <Button variant="primary" onClick={() => setAddModalOpen(true)}>
            + Add New Customer
          </Button>
        }
      />

      {successMsg && (
        <div style={{ background: 'var(--ok-bg, #dcefe4)', color: 'var(--ok, #2f7d57)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="search"
            className="input"
            placeholder="Search customers by phone number or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            style={{ flex: 1 }}
          />
          <Button variant="ghost" onClick={loadData}>Search</Button>
        </div>

        {loading && <LoadingState label="Searching customer directory…" />}
        {error && <ErrorState error={error} onRetry={loadData} />}

        {!loading && !error && (
          <DataTable columns={columns} rows={customers} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Add Customer Modal */}
      {addModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Add Customer Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <Field
                  id="cname"
                  label="Full Name *"
                  placeholder="e.g. Asim Rauf"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
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
                  label="Phone Number (03xx-xxxxxxx) *"
                  placeholder="0300-1234567"
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value)
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
                label="Email (Optional)"
                placeholder="customer@domain.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Field
                id="caddr"
                label="Delivery Address in Karachi"
                placeholder="e.g. Bungalow 22, 5th Zamzama Street, DHA Phase 5"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
              <Field
                id="cnotes"
                label="Special Preferences / Dietary Notes"
                placeholder="e.g. Requests spicy biryani, gate entry code #12"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={handleCreateCustomer}
                  disabled={!newName.trim() || !newPhone.trim()}
                >
                  Save Customer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {historyModalCust && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h2>Order History: {historyModalCust.name}</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Phone: {historyModalCust.phone} · Total Orders: {historyModalCust.total_orders} · Lifetime Spend: {formatPKR(historyModalCust.total_spent)}
            </p>

            {historyLoading && <LoadingState label="Loading past orders…" />}

            {!historyLoading && custOrders.length === 0 && (
              <p className="muted">No recent orders on record for this customer.</p>
            )}

            {!historyLoading && custOrders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {custOrders.map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div>
                      <strong>Order #{o.order_number}</strong> ({o.type.toUpperCase()})
                      <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                        {new Date(o.created_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong className="num">{formatPKR(o.total)}</strong>
                      <div><Badge tone="ok">{o.status.toUpperCase()}</Badge></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="primary" onClick={() => setHistoryModalCust(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
