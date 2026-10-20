import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchKitchenTickets, subscribeToKitchenUpdates, updateOrderStatus } from './api'
import type { Order } from '@/types/domain'

export function KitchenPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [tickets, setTickets] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  const loadTickets = useCallback(async () => {
    try {
      const data = await fetchKitchenTickets(branchId)
      setTickets(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadTickets()

    const handleUpdate = () => {
      loadTickets()
    }

    // Immediate reactive updates when POS books orders
    window.addEventListener('karachi_storage_update', handleUpdate)
    window.addEventListener('karachi-pos-update', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    // Realtime channel subscription
    const unsubscribe = subscribeToKitchenUpdates(branchId, () => {
      loadTickets()
    })
    // Auto-poll fallback every 8 seconds
    const interval = setInterval(loadTickets, 8000)

    return () => {
      window.removeEventListener('karachi_storage_update', handleUpdate)
      window.removeEventListener('karachi-pos-update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
      unsubscribe()
      clearInterval(interval)
    }
  }, [branchId, loadTickets])

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    // Optimistic update: immediately show new status or remove if completed
    setTickets((prev) =>
      newStatus === 'completed'
        ? prev.filter((t) => t.id !== orderId)
        : prev.map((t) => (t.id === orderId ? { ...t, status: newStatus } : t))
    )
    try {
      await updateOrderStatus(orderId, newStatus)
      await loadTickets()
    } catch (err) {
      alert(`KDS error: ${err instanceof Error ? err.message : String(err)}`)
      await loadTickets()
    }
  }

  const getAgeMinutes = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime()
    return Math.floor(diffMs / 60000)
  }

  return (
    <div>
      <PageHeader
        title="Kitchen Display System (KDS)"
        subtitle="Live ticket dispatch for kitchen chefs and station cooks"
        actions={
          <Button size="sm" onClick={loadTickets}>
            🔄 Refresh
          </Button>
        }
      />

      {loading && <LoadingState label="Connecting to kitchen station queue…" />}
      {error && <ErrorState error={error} onRetry={loadTickets} />}

      {!loading && !error && tickets.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ marginBottom: '8px' }}>All Orders Clear!</h2>
            <p className="muted">No orders currently pending preparation in the kitchen queue.</p>
          </div>
        </Card>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="kds-grid">
          {tickets.map((ticket) => {
            const ageMins = getAgeMinutes(ticket.created_at)
            const isUrgent = ageMins >= 15

            return (
              <div
                key={ticket.id}
                className={`kds-ticket ${isUrgent ? 'kds-ticket--urgent' : ''}`}
              >
                <div className="kds-ticket__header">
                  <div>
                    <strong style={{ fontSize: 'var(--fs-lg)' }}>#{ticket.order_number}</strong>
                    <span style={{ marginLeft: '8px' }} className="badge badge--neutral">
                      {ticket.type === 'dine_in'
                        ? ticket.table?.label || 'Dine-In'
                        : ticket.type.toUpperCase()}
                    </span>
                  </div>
                  <Badge tone={isUrgent ? 'danger' : 'warn'}>
                    ⏱️ {ageMins}m ago
                  </Badge>
                </div>

                <div className="kds-ticket__body">
                  {ticket.notes && (
                    <div style={{ padding: '6px 8px', background: 'var(--warn-bg)', borderRadius: 'var(--radius)', fontSize: 'var(--fs-xs)', color: 'var(--warn)' }}>
                      <strong>Note:</strong> {ticket.notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticket.items?.map((it) => (
                      <div key={it.id} className="kds-ticket__item">
                        <span>
                          <strong>{it.quantity}x</strong> {it.item_name}
                          {it.notes && (
                            <small style={{ display: 'block', color: 'var(--amber-600)', fontWeight: 500 }}>
                              ↳ {it.notes}
                            </small>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="kds-ticket__footer">
                  <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                    {(ticket.status === 'sent_to_kitchen' || ticket.status === 'open') && (
                      <Button
                        variant="primary"
                        style={{ flex: 1 }}
                        onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                      >
                        🔥 Start Prep
                      </Button>
                    )}

                    {ticket.status === 'preparing' && (
                      <Button
                        variant="accent"
                        style={{ flex: 1 }}
                        onClick={() => handleUpdateStatus(ticket.id, 'ready')}
                      >
                        ✅ Mark Ready
                      </Button>
                    )}

                    {ticket.status === 'ready' && (
                      <Button
                        variant="primary"
                        style={{ flex: 1 }}
                        onClick={() => handleUpdateStatus(ticket.id, 'completed')}
                      >
                        📦 Dispatch / Done
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
