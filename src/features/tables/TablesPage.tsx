import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchTablesWithOccupancy,
  fetchReservations,
  saveReservationRecord,
  updateReservationStatus,
  saveTableRecord,
} from './api'
import type { DiningTable, TableReservation, MarketingConsent } from '@/types/domain'

export function TablesPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [activeTab, setActiveTab] = useState<'floor' | 'reservations'>('floor')
  const [tables, setTables] = useState<DiningTable[]>([])
  const [reservations, setReservations] = useState<TableReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Table Modal (Create / Edit)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Partial<DiningTable> | null>(null)
  const [tableSubmitting, setTableSubmitting] = useState(false)

  // Reservation Modal (Create / Edit)
  const [resModalOpen, setResModalOpen] = useState(false)
  const [editingRes, setEditingRes] = useState<{
    id?: string
    tableId: string
    customerName: string
    customerPhone: string
    guestCount: number
    reservationTime: string
    notes?: string
    status?: TableReservation['status']
    marketingConsent?: MarketingConsent
  } | null>(null)
  const [resSubmitting, setResSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tList, rList] = await Promise.all([
        fetchTablesWithOccupancy(branchId),
        fetchReservations(branchId),
      ])
      setTables(tList)
      setReservations(rList)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openNewTableModal = () => {
    setEditingTable({
      branch_id: branchId,
      label: '',
      seats: 4,
      location: 'Main Hall',
      is_active: true,
    })
    setTableModalOpen(true)
  }

  const openEditTableModal = (table: DiningTable) => {
    setEditingTable({ ...table })
    setTableModalOpen(true)
  }

  const handleSaveTable = async () => {
    if (!editingTable || !editingTable.label?.trim()) return
    setTableSubmitting(true)
    try {
      const saved = await saveTableRecord(branchId, editingTable)
      setTableModalOpen(false)
      setEditingTable(null)
      setSuccessMsg(`Table "${saved.label}" saved successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Table error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTableSubmitting(false)
    }
  }

  const openNewReservationModal = () => {
    const defaultTableId = tables[0]?.id || ''
    setEditingRes({
      tableId: defaultTableId,
      customerName: '',
      customerPhone: '',
      guestCount: 4,
      reservationTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      notes: '',
      status: 'confirmed',
      marketingConsent: 'opted_in',
    })
    setResModalOpen(true)
  }

  const openEditReservationModal = (r: TableReservation) => {
    setEditingRes({
      id: r.id,
      tableId: r.table_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      guestCount: r.guest_count,
      reservationTime: new Date(r.reservation_time).toISOString().slice(0, 16),
      notes: r.notes || '',
      status: r.status,
      marketingConsent: r.customer?.marketing_consent || 'opted_in',
    })
    setResModalOpen(true)
  }

  const handleSaveReservation = async () => {
    if (!editingRes || !editingRes.customerName.trim() || !editingRes.customerPhone.trim()) return
    setResSubmitting(true)
    try {
      const saved = await saveReservationRecord(branchId, {
        id: editingRes.id,
        tableId: editingRes.tableId,
        customerName: editingRes.customerName,
        customerPhone: editingRes.customerPhone,
        guestCount: editingRes.guestCount,
        reservationTime: new Date(editingRes.reservationTime).toISOString(),
        notes: editingRes.notes,
        status: editingRes.status,
        marketingConsent: editingRes.marketingConsent,
      })
      setResModalOpen(false)
      setEditingRes(null)
      setSuccessMsg(`Reservation for "${saved.customer_name}" saved successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Reservation error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setResSubmitting(false)
    }
  }

  const handleUpdateResStatus = async (resId: string, status: TableReservation['status']) => {
    try {
      await updateReservationStatus(resId, status)
      setSuccessMsg(`Reservation marked as ${status.toUpperCase()}`)
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadData()
    } catch (err) {
      alert(`Update error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const resColumns: Column<TableReservation>[] = [
    {
      key: 'time',
      header: 'Reservation Time',
      render: (r) => (
        <div>
          <strong>{new Date(r.reservation_time).toLocaleDateString('en-GB')}</strong>
          <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
            {new Date(r.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      key: 'guest',
      header: 'Guest Info & CRM',
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>{r.customer_name}</strong>
            {r.customer_id && (
              <Badge tone="info">CRM</Badge>
            )}
          </div>
          <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{r.customer_phone}</span>
          {r.customer && r.customer.total_orders > 0 && (
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--amber-text, #b8860b)' }}>
              ⭐ {r.customer.total_orders} orders ({r.customer.marketing_consent === 'opted_in' ? '🔔 Promo Opted' : '🔕 Opted Out'})
            </span>
          )}
          {r.notes && <span className="muted" style={{ display: 'block', fontSize: '11px', fontStyle: 'italic' }}>Note: {r.notes}</span>}
        </div>
      ),
    },
    {
      key: 'table',
      header: 'Assigned Table',
      render: (r) => {
        const t = tables.find((tb) => tb.id === r.table_id) || r.table
        return <Badge tone="neutral">{t?.label || 'Table'}</Badge>
      },
    },
    {
      key: 'guests',
      header: 'Party Size',
      numeric: true,
      render: (r) => <span>{r.guest_count} persons</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        let tone: 'neutral' | 'ok' | 'warn' | 'info' | 'danger' = 'neutral'
        if (r.status === 'confirmed') tone = 'ok'
        if (r.status === 'seated') tone = 'warn'
        if (r.status === 'cancelled') tone = 'danger'
        return <Badge tone={tone}>{r.status.toUpperCase()}</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <Button size="sm" variant="ghost" onClick={() => openEditReservationModal(r)}>
            ✏️ Edit
          </Button>
          {r.status === 'confirmed' && (
            <Button size="sm" variant="accent" onClick={() => handleUpdateResStatus(r.id, 'seated')}>
              Seat
            </Button>
          )}
          {r.status === 'seated' && (
            <Button size="sm" variant="primary" onClick={() => handleUpdateResStatus(r.id, 'completed')}>
              Complete
            </Button>
          )}
          {r.status !== 'cancelled' && (
            <Button size="sm" variant="danger" onClick={() => handleUpdateResStatus(r.id, 'cancelled')}>
              Cancel
            </Button>
          )}
          {r.status === 'cancelled' && (
            <Button size="sm" variant="ghost" onClick={() => handleUpdateResStatus(r.id, 'confirmed')}>
              Reconfirm
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dining Floor & Reservations"
        subtitle="Table occupancy, hall seating arrangements, and advance guest bookings"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={openNewTableModal}>
              + Add Table
            </Button>
            <Button variant="primary" onClick={openNewReservationModal}>
              📅 Book Reservation
            </Button>
          </div>
        }
      />

      {successMsg && (
        <div style={{ background: 'var(--ok-bg, #dcefe4)', color: 'var(--ok, #2f7d57)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'floor' ? 'btn--primary' : 'btn--ghost'}`}
          style={{ flex: '1 1 220px' }}
          onClick={() => setActiveTab('floor')}
        >
          🍽️ Floor Layout & Occupancy ({tables.length} Tables)
        </button>
        <button
          className={`btn ${activeTab === 'reservations' ? 'btn--primary' : 'btn--ghost'}`}
          style={{ flex: '1 1 220px' }}
          onClick={() => setActiveTab('reservations')}
        >
          📖 Guest Reservations ({reservations.length})
        </button>
      </div>

      {loading && <LoadingState label="Loading table occupancy and bookings…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && activeTab === 'floor' && (
        <div className="grid-3">
          {tables.map((t) => {
            const isOccupied = Boolean(t.current_order_id)
            return (
              <div
                key={t.id}
                className="card"
                style={{
                  borderLeft: isOccupied ? '4px solid var(--amber-500, #ff5b26)' : '4px solid var(--ok, #2f7d57)',
                  padding: 'var(--s-4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>{t.label}</h3>
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)', display: 'block', marginTop: '2px' }}>
                      Capacity: {t.seats} Persons · {t.location || 'Dining Floor'}
                    </span>
                  </div>
                  <Badge tone={isOccupied ? 'warn' : 'ok'}>
                    {isOccupied ? `OCCUPIED (${t.current_order_status?.toUpperCase() || 'BUSY'})` : 'AVAILABLE'}
                  </Badge>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    {isOccupied ? 'Guests seated / dining' : 'Clean & ready for guests'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button size="sm" variant="ghost" onClick={() => openEditTableModal(t)}>
                      ✏️ Edit Table
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && activeTab === 'reservations' && (
        <Card title="Active Reservations">
          <DataTable columns={resColumns} rows={reservations} rowKey={(r) => r.id} />
        </Card>
      )}

      {/* Book / Edit Reservation Modal */}
      {resModalOpen && editingRes && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>{editingRes.id ? 'Edit Table Reservation' : 'Book Table Reservation'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Table</label>
                <select
                  className="input"
                  value={editingRes.tableId}
                  onChange={(e) => setEditingRes({ ...editingRes, tableId: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({t.seats} seats - {t.location || 'Floor'})</option>
                  ))}
                </select>
              </div>

              <Field
                id="cname"
                label="Customer Full Name *"
                placeholder="e.g. Tariq Mehmood"
                value={editingRes.customerName}
                onChange={(e) => setEditingRes({ ...editingRes, customerName: e.target.value })}
              />

              <Field
                id="cphone"
                label="Customer Contact Phone *"
                placeholder="0300-xxxxxxx"
                value={editingRes.customerPhone}
                onChange={(e) => setEditingRes({ ...editingRes, customerPhone: e.target.value })}
              />

              <Field
                id="guests"
                label="Number of Guests"
                type="number"
                min="1"
                value={editingRes.guestCount}
                onChange={(e) => setEditingRes({ ...editingRes, guestCount: parseInt(e.target.value, 10) || 1 })}
              />

              <div>
                <label className="field__label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editingRes.reservationTime}
                  onChange={(e) => setEditingRes({ ...editingRes, reservationTime: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="field__label">Status</label>
                <select
                  className="input"
                  value={editingRes.status || 'confirmed'}
                  onChange={(e) => setEditingRes({ ...editingRes, status: e.target.value as 'confirmed' | 'seated' | 'completed' | 'cancelled' })}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="seated">Seated</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <Field
                id="notes"
                label="Special Requests / Seating Notes"
                placeholder="e.g. High chair needed, anniversary dinner"
                value={editingRes.notes || ''}
                onChange={(e) => setEditingRes({ ...editingRes, notes: e.target.value })}
              />

              <div style={{ border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius)', background: 'var(--surface-muted)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                  <input
                    type="checkbox"
                    checked={editingRes.marketingConsent === 'opted_in'}
                    onChange={(e) => setEditingRes({
                      ...editingRes,
                      marketingConsent: e.target.checked ? 'opted_in' : 'opted_out'
                    })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong>Marketing Consent for Promotions & Deals</strong>
                    <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>
                      Guest agreed to receive promotional combo deals and special event discounts via SMS/WhatsApp. Operational booking notices are always sent regardless of this setting.
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setResModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={resSubmitting}
                  onClick={handleSaveReservation}
                  disabled={!editingRes.customerName.trim() || !editingRes.customerPhone.trim() || !editingRes.tableId}
                >
                  Save Reservation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {tableModalOpen && editingTable && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>{editingTable.id ? 'Edit Dining Table' : 'Add Dining Table'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <Field
                id="tlabel"
                label="Table Label / Number *"
                placeholder="e.g. Table 7 (Terrace)"
                value={editingTable.label || ''}
                onChange={(e) => setEditingTable({ ...editingTable, label: e.target.value })}
              />
              <Field
                id="tseats"
                label="Seating Capacity"
                type="number"
                min="1"
                value={editingTable.seats || 4}
                onChange={(e) => setEditingTable({ ...editingTable, seats: parseInt(e.target.value, 10) || 2 })}
              />
              <Field
                id="tloc"
                label="Floor Location / Hall (Optional)"
                placeholder="e.g. Family Hall, VIP Lounge, Balcony"
                value={editingTable.location || ''}
                onChange={(e) => setEditingTable({ ...editingTable, location: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setTableModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={tableSubmitting}
                  onClick={handleSaveTable}
                  disabled={!editingTable.label?.trim()}
                >
                  Save Table
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
