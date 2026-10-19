import { useEffect, useState, useCallback, useMemo } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchSuppliers,
  createSupplier,
  fetchPurchaseOrders,
  createPurchaseOrderRpc,
  receivePurchaseOrderRpc,
} from './api'
import { fetchInventoryItems } from '@/features/inventory/api'
import type { Supplier, PurchaseOrder, InventoryItem } from '@/types/domain'

export function PurchasingPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Modals
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [supModalOpen, setSupModalOpen] = useState(false)

  // New Supplier Form
  const [supName, setSupName] = useState('')
  const [supContact, setSupContact] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supAddress, setSupAddress] = useState('')

  // New PO Form
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState(`PO-${Date.now().toString().slice(-6)}`)
  const [poInvoice, setPoInvoice] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poLines, setPoLines] = useState<Array<{ inventory_item_id: string; quantity: number; unit_cost: number }>>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sups, pos, inv] = await Promise.all([
        fetchSuppliers(branchId),
        fetchPurchaseOrders(branchId),
        fetchInventoryItems(branchId),
      ])
      setSuppliers(sups)
      setOrders(pos)
      setInventory(inv)
      if (sups.length > 0) {
        setPoSupplierId((prev) => prev || sups[0].id)
      }
      if (inv.length > 0) {
        setPoLines((prev) => prev.length === 0 ? [{ inventory_item_id: inv[0].id, quantity: 20, unit_cost: 350 }] : prev)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddPoLine = () => {
    if (inventory.length === 0) return
    setPoLines((prev) => [...prev, { inventory_item_id: inventory[0].id, quantity: 10, unit_cost: 200 }])
  }

  const handleRemovePoLine = (index: number) => {
    setPoLines((prev) => prev.filter((_, i) => i !== index))
  }

  const estimatedPoTotal = useMemo(() => {
    return poLines.reduce((acc, l) => acc + (l.quantity * l.unit_cost), 0)
  }, [poLines])

  const handleCreateSupplier = async () => {
    if (!supName.trim()) return
    try {
      await createSupplier(branchId, {
        name: supName.trim(),
        contact_person: supContact,
        phone: supPhone,
        email: supEmail,
        address: supAddress,
      })
      setSupModalOpen(false)
      setSupName('')
      setSupPhone('')
      await loadData()
    } catch (err) {
      alert(`Supplier error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCreatePO = async () => {
    if (!poSupplierId || poLines.length === 0) return
    try {
      await createPurchaseOrderRpc({
        branchId,
        supplierId: poSupplierId,
        poNumber,
        invoiceNo: poInvoice,
        notes: poNotes,
        items: poLines,
      })
      setPoModalOpen(false)
      setPoNumber(`PO-${Date.now().toString().slice(-6)}`)
      await loadData()
    } catch (err) {
      alert(`PO creation error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleReceivePO = async (poId: string) => {
    try {
      await receivePurchaseOrderRpc(poId)
      await loadData()
    } catch (err) {
      alert(`PO receiving error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const poColumns: Column<PurchaseOrder>[] = [
    {
      key: 'po_number',
      header: 'PO #',
      render: (r) => <strong>{r.po_number}</strong>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (r) => <span>{r.supplier?.name || 'Supplier'}</span>,
    },
    {
      key: 'date',
      header: 'Ordered Date',
      render: (r) => (
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {new Date(r.created_at).toLocaleDateString('en-GB')}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Amount (PKR)',
      numeric: true,
      render: (r) => <strong>{formatPKR(r.total_amount)}</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const isRecv = r.status === 'received'
        return <Badge tone={isRecv ? 'ok' : 'warn'}>{r.status.toUpperCase()}</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div>
          {r.status !== 'received' && (
            <Button size="sm" variant="accent" onClick={() => handleReceivePO(r.id)}>
              📥 Receive & Restock
            </Button>
          )}
          {r.status === 'received' && (
            <span className="muted" style={{ fontSize: '11px' }}>Restocked into Ledger</span>
          )}
        </div>
      ),
    },
  ]

  const supColumns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Vendor Name',
      render: (r) => <strong>{r.name}</strong>,
    },
    {
      key: 'contact',
      header: 'Contact Person',
      render: (r) => <span>{r.contact_person || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => <span>{r.phone || '—'}</span>,
    },
    {
      key: 'address',
      header: 'Address',
      render: (r) => <span className="muted">{r.address || '—'}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Purchasing & Vendor Management"
        subtitle="Manage bulk procurement, purchase receipts, and automatic stock replenishments"
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => setSupModalOpen(true)}>
              + Add Supplier
            </Button>
            <Button variant="primary" onClick={() => setPoModalOpen(true)}>
              + New Purchase Order
            </Button>
          </div>
        }
      />

      {/* Purchasing KPI Overview Row */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-card__label">Total Orders</span>
          <span className="stat-card__val">{orders.length}</span>
          <span className="stat-card__hint">Lifetime procurement POs</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Procurement Spend</span>
          <span className="stat-card__val" style={{ color: 'var(--orange-600)' }}>
            {formatPKR(orders.reduce((acc, o) => acc + o.total_amount, 0))}
          </span>
          <span className="stat-card__hint">Total inventory investment</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Pending Receipts</span>
          <span className="stat-card__val" style={{ color: orders.filter((o) => o.status !== 'received').length > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {orders.filter((o) => o.status !== 'received').length}
          </span>
          <span className="stat-card__hint">Awaiting delivery & restock</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Approved Vendors</span>
          <span className="stat-card__val">{suppliers.length}</span>
          <span className="stat-card__hint">Active wholesale suppliers</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'orders' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('orders')}
        >
          📋 Purchase Orders ({orders.length})
        </button>
        <button
          className={`btn ${activeTab === 'suppliers' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('suppliers')}
        >
          🏢 Approved Suppliers ({suppliers.length})
        </button>
      </div>

      {loading && <LoadingState label="Loading procurement and supplier directories…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && activeTab === 'orders' && (
        <Card title="Purchase Orders">
          <DataTable columns={poColumns} rows={orders} rowKey={(r) => r.id} />
        </Card>
      )}

      {!loading && !error && activeTab === 'suppliers' && (
        <Card title="Supplier Directory">
          <DataTable columns={supColumns} rows={suppliers} rowKey={(r) => r.id} />
        </Card>
      )}

      {/* New Purchase Order Modal */}
      {poModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <h2>Create Purchase Order</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Supplier</label>
                <select
                  className="input"
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field
                  id="po-num"
                  label="PO Number"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />

                <Field
                  id="po-inv"
                  label="Vendor Invoice # (Optional)"
                  placeholder="e.g. INV-10921"
                  value={poInvoice}
                  onChange={(e) => setPoInvoice(e.target.value)}
                />
              </div>

              <Field
                id="po-notes"
                label="Order Notes / Delivery Terms"
                placeholder="e.g. Deliver before 11:00 AM to Clifton kitchen"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
              />

              {/* Line Items Container with Add/Remove & Min-Width: 0 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="field__label">Order Items:</span>
                  <Button size="sm" variant="accent" onClick={handleAddPoLine}>
                    + Add Item
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {poLines.map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                      <select
                        className="input"
                        value={line.inventory_item_id}
                        onChange={(e) => {
                          const val = e.target.value
                          setPoLines((prev) => prev.map((l, i) => i === idx ? { ...l, inventory_item_id: val } : l))
                        }}
                        style={{ flex: 3, minWidth: 0 }}
                      >
                        {inventory.map((i) => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        className="input num"
                        placeholder="Qty"
                        value={line.quantity || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setPoLines((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: val } : l))
                        }}
                        style={{ flex: 1.2, minWidth: '60px' }}
                      />

                      <input
                        type="number"
                        className="input num"
                        placeholder="Cost Rs"
                        value={line.unit_cost || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setPoLines((prev) => prev.map((l, i) => i === idx ? { ...l, unit_cost: val } : l))
                        }}
                        style={{ flex: 1.5, minWidth: '70px' }}
                      />

                      {poLines.length > 1 && (
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          style={{ padding: '0 8px', color: 'var(--danger)' }}
                          onClick={() => handleRemovePoLine(idx)}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Estimated PO Total Preview */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '10px 14px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Estimated Order Total:</span>
                  <strong className="num" style={{ fontSize: 'var(--fs-md)', color: 'var(--orange-600)' }}>
                    {formatPKR(estimatedPoTotal)}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="ghost" onClick={() => setPoModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreatePO} disabled={poLines.length === 0}>
                  Submit Purchase Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {supModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Register Approved Supplier</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <Field
                id="sname"
                label="Supplier Business Name"
                placeholder="e.g. Al-Madina Fresh Meat & Poultry"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
              />
              <Field
                id="scontact"
                label="Contact Person Name"
                placeholder="e.g. Sheikh Naveed"
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
              />
              <Field
                id="sphone"
                label="Phone Number"
                placeholder="0300-xxxxxxx"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
              />
              <Field
                id="semail"
                label="Email Address"
                placeholder="vendor@domain.com"
                value={supEmail}
                onChange={(e) => setSupEmail(e.target.value)}
              />
              <Field
                id="saddr"
                label="Physical Address / Market Location"
                placeholder="e.g. Wholesale Market, Karachi"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setSupModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreateSupplier} disabled={!supName.trim()}>
                  Save Supplier
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
