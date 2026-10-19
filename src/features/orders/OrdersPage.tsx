import { useEffect, useState, useCallback, useDeferredValue } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchOrders, updateOrderStatus, assignRider } from './api'
import { ReceiptModal } from '@/components/ReceiptModal'
import type { Order, OrderStatus, OrderType } from '@/types/domain'

export function OrdersPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  // Modals
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null)
  const [riderModalOrder, setRiderModalOrder] = useState<Order | null>(null)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrders(branchId, {
        status: statusFilter,
        type: typeFilter,
        search: deferredSearch,
      })
      setOrders(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, statusFilter, typeFilter, deferredSearch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setLoadingActionId(orderId)
    // Optimistic UI update so the change reflects in 0ms without lag
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
    )
    try {
      await updateOrderStatus(orderId, newStatus)
      await loadData()
    } catch (err) {
      alert(`Status transition error: ${err instanceof Error ? err.message : String(err)}`)
      await loadData()
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleSaveRider = async () => {
    if (!riderModalOrder) return
    setLoadingActionId(riderModalOrder.id)
    try {
      await assignRider(riderModalOrder.id, riderName, riderPhone, 'out_for_delivery')
      setRiderModalOrder(null)
      await loadData()
    } catch (err) {
      alert(`Rider assign error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingActionId(null)
    }
  }

  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      header: 'Order #',
      render: (r) => <strong>#{r.order_number}</strong>,
    },
    {
      key: 'time',
      header: 'Time',
      render: (r) => (
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Channel',
      render: (r) => {
        let label = r.type.toUpperCase()
        if (r.type === 'dine_in' && r.table) label = `${r.table.label}`
        return <Badge tone="neutral">{label}</Badge>
      },
    },
    {
      key: 'customer',
      header: 'Customer / Destination',
      render: (r) => (
        <div>
          <div>{r.customer_name || 'Counter Guest'}</div>
          {r.customer_phone && <small className="muted">{r.customer_phone}</small>}
          {r.rider_name && (
            <div style={{ fontSize: '11px', color: 'var(--info)', marginTop: '2px' }}>
              🛵 Rider: {r.rider_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (r) => (
        <span style={{ fontSize: 'var(--fs-xs)' }}>
          {r.items?.map((it) => `${it.quantity}x ${it.item_name}`).join(', ') || 'No items'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (r) => <strong>{formatPKR(r.total)}</strong>,
    },
    {
      key: 'status',
      header: 'Order Status',
      render: (r) => {
        let tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' = 'neutral'
        if (r.status === 'completed') tone = 'ok'
        if (r.status === 'preparing') tone = 'warn'
        if (r.status === 'ready') tone = 'info'
        if (r.status === 'served') tone = 'info'
        if (r.status === 'cancelled') tone = 'danger'
        return (
          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={tone}>{r.status.replace(/_/g, ' ').toUpperCase()}</Badge>
            {r.rider_status === 'out_for_delivery' && <Badge tone="warn">OUT FOR DELIVERY</Badge>}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <Button size="sm" variant="ghost" onClick={() => setActiveReceiptOrder(r)}>
            🧾 Receipt
          </Button>

          {r.status === 'open' && (
            <Button
              size="sm"
              variant="accent"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'sent_to_kitchen')}
            >
              {loadingActionId === r.id ? 'Sending...' : 'Send Kitchen'}
            </Button>
          )}

          {r.status === 'sent_to_kitchen' && (
            <Button
              size="sm"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'preparing')}
            >
              {loadingActionId === r.id ? 'Updating...' : 'Start Prep'}
            </Button>
          )}

          {r.status === 'preparing' && (
            <Button
              size="sm"
              variant="accent"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'ready')}
            >
              {loadingActionId === r.id ? 'Updating...' : 'Mark Ready'}
            </Button>
          )}

          {r.status === 'ready' && r.type === 'dine_in' && (
            <Button
              size="sm"
              variant="primary"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'served')}
            >
              {loadingActionId === r.id ? 'Serving...' : 'Serve Table'}
            </Button>
          )}

          {r.status === 'ready' && r.type === 'delivery' && (
            <Button
              size="sm"
              variant="accent"
              disabled={loadingActionId === r.id}
              onClick={() => {
                setRiderName(r.rider_name || '')
                setRiderPhone(r.rider_phone || '')
                setRiderModalOrder(r)
              }}
            >
              Assign Rider
            </Button>
          )}

          {(r.status === 'served' || r.status === 'ready' || r.rider_status === 'out_for_delivery') && (
            <Button
              size="sm"
              variant="primary"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'completed')}
            >
              {loadingActionId === r.id ? 'Completing...' : 'Complete'}
            </Button>
          )}

          {r.status !== 'completed' && r.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="danger"
              disabled={loadingActionId === r.id}
              onClick={() => handleStatusChange(r.id, 'cancelled')}
            >
              {loadingActionId === r.id ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Order Management"
        subtitle="Live tracking, valid status transitions, and rider assignment"
        actions={
          <Button variant="ghost" onClick={loadData}>
            🔄 Refresh Orders
          </Button>
        }
      />

      {/* Filter Tabs & Search */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <input
            type="search"
            className="input"
            placeholder="Search by customer name, phone, or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            style={{ minWidth: '240px', flex: 1 }}
          />

          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', maxWidth: '100%', paddingBottom: '2px' }}>
            {(['all', 'open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const).map(
              (st) => (
                <button
                  key={st}
                  className={`btn btn--sm ${statusFilter === st ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => setStatusFilter(st)}
                  style={{ textTransform: 'capitalize', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              )
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', maxWidth: '100%', paddingBottom: '2px' }}>
            {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((tp) => (
              <button
                key={tp}
                className={`btn btn--sm ${typeFilter === tp ? 'btn--accent' : 'btn--ghost'}`}
                onClick={() => setTypeFilter(tp)}
                style={{ textTransform: 'capitalize', flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {tp.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading && <LoadingState label="Loading orders from database…" />}
        {error && <ErrorState error={error} onRetry={loadData} />}
        {!loading && !error && (
          <DataTable columns={columns} rows={orders} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Rider Assignment Modal */}
      {riderModalOrder && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Assign Delivery Rider</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Order #{riderModalOrder.order_number} · Delivery to: {riderModalOrder.delivery_address}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="field__label">Rider Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Asad (Bykea / In-House)"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="field__label">Rider Phone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 0345-9876543"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="ghost" onClick={() => setRiderModalOrder(null)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveRider} disabled={!riderName}>
                  Confirm Dispatch
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {activeReceiptOrder && (
        <ReceiptModal order={activeReceiptOrder} onClose={() => setActiveReceiptOrder(null)} />
      )}
    </div>
  )
}
