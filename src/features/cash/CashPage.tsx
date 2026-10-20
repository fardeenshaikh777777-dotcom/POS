import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchActiveCashSession,
  openCashSessionRpc,
  closeCashSessionRpc,
  recordCashMovementRpc,
  fetchCashHistory,
  fetchSessionDetails,
} from './api'
import type { CashSession, CashMovement, CashMovementKind, Payment } from '@/types/domain'

export function CashPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [sessionPayments, setSessionPayments] = useState<Payment[]>([])
  const [sessionMovements, setSessionMovements] = useState<CashMovement[]>([])
  const [history, setHistory] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Modals
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [openingFloat, setOpeningFloat] = useState(5000)
  const [openNotes, setOpenNotes] = useState('')

  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [countedCash, setCountedCash] = useState<string>('')
  const [closeNotes, setCloseNotes] = useState('')
  const [closeResult, setCloseResult] = useState<{
    expected_cash: number
    counted_cash: number
    variance: number
  } | null>(null)

  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveKind, setMoveKind] = useState<CashMovementKind>('pay_in')
  const [moveAmount, setMoveAmount] = useState<number>(1000)
  const [moveReason, setMoveReason] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [current, past] = await Promise.all([
        fetchActiveCashSession(branchId),
        fetchCashHistory(branchId),
      ])
      setActiveSession(current)
      setHistory(past)

      if (current) {
        const details = await fetchSessionDetails(current.id)
        setSessionPayments(details.payments)
        setSessionMovements(details.movements)
      } else {
        setSessionPayments([])
        setSessionMovements([])
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()

    const handleUpdate = () => {
      loadData()
    }

    window.addEventListener('karachi_storage_update', handleUpdate)
    window.addEventListener('karachi-pos-update', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    return () => {
      window.removeEventListener('karachi_storage_update', handleUpdate)
      window.removeEventListener('karachi-pos-update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
    }
  }, [loadData])

  const handleOpenSession = async () => {
    try {
      await openCashSessionRpc(branchId, openingFloat, openNotes)
      setOpenModalOpen(false)
      await loadData()
    } catch (err) {
      alert(`Open session error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCloseSession = async () => {
    if (!activeSession) return
    const counted = parseFloat(countedCash) || 0
    try {
      const res = await closeCashSessionRpc(activeSession.id, counted, closeNotes)
      setCloseResult({
        expected_cash: res.expected_cash,
        counted_cash: res.counted_cash,
        variance: res.variance,
      })
      await loadData()
    } catch (err) {
      alert(`Close session error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRecordMovement = async () => {
    if (!activeSession || moveAmount <= 0 || !moveReason.trim()) return
    try {
      await recordCashMovementRpc(activeSession.id, moveKind, moveAmount, moveReason.trim(), activeSession.branch_id)
      setMoveModalOpen(false)
      setMoveReason('')
      await loadData()
    } catch (err) {
      alert(`Cash movement error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Calculate live session running totals
  const totalCashSales = sessionPayments.reduce((acc, p) => acc + p.amount, 0)
  const totalPayIns = sessionMovements
    .filter((m) => m.kind === 'pay_in')
    .reduce((acc, m) => acc + m.amount, 0)
  const totalPayOuts = sessionMovements
    .filter((m) => m.kind === 'pay_out' || m.kind === 'expense')
    .reduce((acc, m) => acc + m.amount, 0)

  const currentExpectedCash = (activeSession?.opening_float || 0) + totalCashSales + totalPayIns - totalPayOuts

  const historyColumns: Column<CashSession>[] = [
    {
      key: 'opened_at',
      header: 'Shift Open',
      render: (r) => (
        <div>
          <strong>{new Date(r.opened_at).toLocaleDateString('en-GB')}</strong>
          <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
            {new Date(r.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      key: 'opened_by',
      header: 'Cashier / Staff',
      render: (r) => <span>{r.opened_by_profile?.full_name || 'Cashier'}</span>,
    },
    {
      key: 'opening_float',
      header: 'Opening Float',
      numeric: true,
      render: (r) => <span>{formatPKR(r.opening_float)}</span>,
    },
    {
      key: 'expected',
      header: 'Expected Cash',
      numeric: true,
      render: (r) => (
        <span>{r.expected_cash != null ? formatPKR(r.expected_cash) : '—'}</span>
      ),
    },
    {
      key: 'counted',
      header: 'Counted Cash',
      numeric: true,
      render: (r) => (
        <span>{r.counted_cash != null ? formatPKR(r.counted_cash) : '—'}</span>
      ),
    },
    {
      key: 'variance',
      header: 'Variance',
      numeric: true,
      render: (r) => {
        if (r.variance == null) return <span>—</span>
        let color = 'var(--ok)'
        if (r.variance < 0) color = 'var(--danger)'
        if (r.variance > 0) color = 'var(--warn)'
        return (
          <strong style={{ color }} className="num">
            {r.variance > 0 ? `+${formatPKR(r.variance)}` : formatPKR(r.variance)}
          </strong>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={r.closed_at ? 'ok' : 'warn'}>
          {r.closed_at ? 'CLOSED' : 'OPEN'}
        </Badge>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Cash Drawer & Reconciliation"
        subtitle="Shift opening float, cash balancing, petty cash tracking, and discrepancy resolution"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {!activeSession ? (
              <Button variant="accent" onClick={() => setOpenModalOpen(true)}>
                🔑 Open Cash Drawer
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setMoveModalOpen(true)}>
                  💵 Pay In / Pay Out
                </Button>
                <Button variant="primary" onClick={() => setCloseModalOpen(true)}>
                  🔒 Close Register & Reconcile
                </Button>
              </>
            )}
          </div>
        }
      />

      {loading && <LoadingState label="Checking till status and audit records…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          {/* Active Session Status Widget */}
          {activeSession ? (
            <Card title="Current Live Cash Session">
              <div className="grid-4" style={{ marginBottom: '16px' }}>
                <div className="stat-card">
                  <span className="stat-card__label">Opening Float</span>
                  <span className="stat-card__val">{formatPKR(activeSession.opening_float)}</span>
                  <span className="stat-card__hint">Cash placed at start of shift</span>
                </div>

                <div className="stat-card">
                  <span className="stat-card__label">Cash Sales Collected</span>
                  <span className="stat-card__val" style={{ color: 'var(--ok)' }}>
                    {formatPKR(totalCashSales)}
                  </span>
                  <span className="stat-card__hint">{sessionPayments.length} counter cash bills</span>
                </div>

                <div className="stat-card">
                  <span className="stat-card__label">Drawer Movements</span>
                  <span className="stat-card__val">
                    +{formatPKR(totalPayIns)} / -{formatPKR(totalPayOuts)}
                  </span>
                  <span className="stat-card__hint">Pay-ins & paid-out expenses</span>
                </div>

                <div className="stat-card" style={{ border: '2px solid var(--amber-500)' }}>
                  <span className="stat-card__label">Expected In Drawer</span>
                  <span className="stat-card__val" style={{ color: 'var(--amber-600)' }}>
                    {formatPKR(currentExpectedCash)}
                  </span>
                  <span className="stat-card__hint">Calculated live by server</span>
                </div>
              </div>

              {/* Drawer Cash Movements Log */}
              {sessionMovements.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 'var(--fs-sm)', marginBottom: '8px', color: 'var(--text-muted)' }}>
                    Shift Drawer Pay-Ins & Pay-Outs:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sessionMovements.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          background: 'var(--surface-muted)',
                          borderRadius: 'var(--radius)',
                          fontSize: 'var(--fs-sm)',
                        }}
                      >
                        <span>
                          <Badge tone={m.kind === 'pay_in' ? 'ok' : 'danger'}>
                            {m.kind.toUpperCase()}
                          </Badge>{' '}
                          {m.reason}
                        </span>
                        <strong className="num">{formatPKR(m.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '36px' }}>
                <h3 style={{ marginBottom: '8px' }}>Register Drawer is Currently Closed</h3>
                <p className="muted" style={{ marginBottom: '16px' }}>
                  No active cashier session. You must open a shift with an initial cash float before taking cash orders.
                </p>
                <Button variant="accent" onClick={() => setOpenModalOpen(true)}>
                  🔑 Open Shift Float Now
                </Button>
              </div>
            </Card>
          )}

          {/* Past Shift History */}
          <Card title="Past Shift Reconciliation Audits">
            <DataTable columns={historyColumns} rows={history} rowKey={(r) => r.id} />
          </Card>
        </div>
      )}

      {/* Open Session Modal */}
      {openModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Open Shift / Cash Register</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Count the physical banknotes in the drawer and record the initial opening float.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field
                id="float"
                label="Opening Float Amount (PKR)"
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
              />

              <Field
                id="notes"
                label="Shift Notes / Register ID"
                placeholder="e.g. Counter Till 1 Morning Shift"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setOpenModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleOpenSession} disabled={openingFloat < 0}>
                  Confirm & Open Register
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Register & Reconcile Modal */}
      {closeModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Close Cash Register & Reconcile</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Perform the end-of-shift cash drawer count. Enter the exact physical rupees in the register.
            </p>

            {!closeResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Opening Float:</span>
                    <strong className="num">{formatPKR(activeSession?.opening_float || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Total Cash Sales:</span>
                    <strong className="num">{formatPKR(totalCashSales)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
                    <span>Live Server Expected Cash:</span>
                    <strong className="num" style={{ color: 'var(--amber-600)' }}>
                      {formatPKR(currentExpectedCash)}
                    </strong>
                  </div>
                </div>

                <Field
                  id="counted"
                  label="Actual Counted Cash in Drawer (PKR)"
                  type="number"
                  placeholder="Enter counted rupees"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                />

                <Field
                  id="cnotes"
                  label="Reconciliation Notes (Explain any discrepancy)"
                  placeholder="e.g. Small change shortage or drawer balanced"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <Button variant="ghost" onClick={() => setCloseModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCloseSession} disabled={!countedCash}>
                    Submit Closing & Lock Drawer
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '16px', background: 'var(--w-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Expected Cash:</span>
                    <strong className="num">{formatPKR(closeResult.expected_cash)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Counted Cash:</span>
                    <strong className="num">{formatPKR(closeResult.counted_cash)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-strong)', paddingTop: '8px', fontSize: 'var(--fs-lg)' }}>
                    <span>Discrepancy (Variance):</span>
                    <strong
                      className="num"
                      style={{ color: closeResult.variance === 0 ? 'var(--ok)' : 'var(--danger)' }}
                    >
                      {closeResult.variance > 0
                        ? `+${formatPKR(closeResult.variance)} (OVER)`
                        : closeResult.variance < 0
                        ? `${formatPKR(closeResult.variance)} (SHORT)`
                        : '0 (PERFECT BALANCE)'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setCloseModalOpen(false)
                      setCloseResult(null)
                    }}
                  >
                    Done & Return
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay In / Pay Out Modal */}
      {moveModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Record Drawer Cash Movement</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Movement Type</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    className={`btn ${moveKind === 'pay_in' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setMoveKind('pay_in')}
                    style={{ flex: 1 }}
                  >
                    📥 Pay-In (Add Cash)
                  </button>
                  <button
                    className={`btn ${moveKind === 'pay_out' ? 'btn--danger' : 'btn--ghost'}`}
                    onClick={() => setMoveKind('pay_out')}
                    style={{ flex: 1 }}
                  >
                    📤 Pay-Out (Remove Cash)
                  </button>
                </div>
              </div>

              <Field
                id="mamt"
                label="Amount (PKR)"
                type="number"
                value={moveAmount}
                onChange={(e) => setMoveAmount(parseFloat(e.target.value) || 0)}
              />

              <Field
                id="mreason"
                label="Reason / Purpose"
                placeholder="e.g. Added change coins or emergency ice purchase"
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setMoveModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleRecordMovement} disabled={!moveReason.trim() || moveAmount <= 0}>
                  Confirm Movement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
