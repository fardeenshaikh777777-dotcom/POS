import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchSalesReport, type SalesReportData } from './api'

export function ReportsPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const todayStr = new Date().toISOString().slice(0, 10)
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [report, setReport] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSalesReport(branchId, startDate, endDate)
      setReport(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, startDate, endDate])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  // Reactive listener so placing orders in POS or updating orders immediately refreshes reports
  useEffect(() => {
    const handleUpdate = () => {
      loadReport()
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
  }, [loadReport])

  const setPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    setActivePreset(preset)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    if (preset === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (preset === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      const ys = y.toISOString().slice(0, 10)
      setStartDate(ys)
      setEndDate(ys)
    } else if (preset === 'week') {
      const w = new Date()
      w.setDate(w.getDate() - 7)
      setStartDate(w.toISOString().slice(0, 10))
      setEndDate(today)
    } else if (preset === 'month') {
      const m = new Date()
      m.setDate(m.getDate() - 30)
      setStartDate(m.toISOString().slice(0, 10))
      setEndDate(today)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sales & Operational Reports"
        subtitle="Audited financial summaries, channel metrics, and dish popularity"
        actions={
          <Button variant="ghost" onClick={() => window.print()}>
            🖨️ Print Financial Statement
          </Button>
        }
      />

      {/* Date Range Selector */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <button
              className={`btn btn--sm ${activePreset === 'today' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setPreset('today')}
            >
              Today
            </button>
            <button
              className={`btn btn--sm ${activePreset === 'yesterday' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setPreset('yesterday')}
            >
              Yesterday
            </button>
            <button
              className={`btn btn--sm ${activePreset === 'week' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setPreset('week')}
            >
              Last 7 Days
            </button>
            <button
              className={`btn btn--sm ${activePreset === 'month' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setPreset('month')}
            >
              Last 30 Days
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="field__label" style={{ margin: 0 }}>From:</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setActivePreset('custom')
              }}
              style={{ fontSize: 'var(--fs-sm)' }}
            />
            <label className="field__label" style={{ margin: 0 }}>To:</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setActivePreset('custom')
              }}
              style={{ fontSize: 'var(--fs-sm)' }}
            />
            <Button size="sm" variant="primary" onClick={loadReport}>
              Apply Filter
            </Button>
          </div>
        </div>
      </Card>

      {loading && <LoadingState label="Computing financial audit report…" />}
      {error && <ErrorState error={error} onRetry={loadReport} />}

      {!loading && !error && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)', marginTop: 'var(--s-4)' }}>
          {/* Top Level Financial Summary (Profit & Loss) */}
          <div className="grid-5">
            <div className="stat-card">
              <span className="stat-card__label">Gross Food Sales</span>
              <span className="stat-card__val">{formatPKR(report.grossSales)}</span>
              <span className="stat-card__hint">Before deductions & taxes</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">Discounts Given</span>
              <span className="stat-card__val" style={{ color: 'var(--danger)' }}>
                -{formatPKR(report.discounts)}
              </span>
              <span className="stat-card__hint">Promotional adjustments</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">Net Revenue</span>
              <span className="stat-card__val" style={{ color: 'var(--amber-600)' }}>
                {formatPKR(report.netSales)}
              </span>
              <span className="stat-card__hint">{report.orderCount} orders · SST {formatPKR(report.taxCollected)}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">Operating Expenses</span>
              <span className="stat-card__val" style={{ color: '#FF5B26' }}>
                {formatPKR(report.totalExpenses)}
              </span>
              <span className="stat-card__hint">Supplies, utilities & payouts</span>
            </div>

            {(() => {
              const isProfitable = report.netProfit >= 0
              const margin = report.netSales > 0 ? Math.round((report.netProfit / report.netSales) * 100) : 0
              return (
                <div className="stat-card" style={{ border: '2px solid var(--ok, #10B981)', background: 'var(--surface)' }}>
                  <span className="stat-card__label" style={{ fontWeight: 700, color: 'var(--text)' }}>Net Operating Profit</span>
                  <span className="stat-card__val" style={{ color: isProfitable ? 'var(--ok, #10B981)' : 'var(--danger)' }}>
                    {formatPKR(report.netProfit)}
                  </span>
                  <span className="stat-card__hint" style={{ color: isProfitable ? 'var(--ok, #10B981)' : 'var(--danger)', fontWeight: 600 }}>
                    {margin >= 0 ? `+${margin}% Profit Margin` : `${margin}% Margin`} (Revenue − Expenses)
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Payment & Channel Breakdown */}
          <div className="grid-2">
            <Card title="Payment Method Mix">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(report.paymentsBreakdown).map(([method, amount]) => {
                  const pct = report.netSales > 0 ? Math.round((amount / report.netSales) * 100) : 0
                  return (
                    <div key={method}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{method}</span>
                        <span>
                          <strong className="num">{formatPKR(amount)}</strong> ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--w-200)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--amber-500)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="Order Channel Mix">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(report.typeBreakdown).map(([type, count]) => {
                  const pct = report.orderCount > 0 ? Math.round((count / report.orderCount) * 100) : 0
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{type.replace('_', ' ')}</span>
                        <span>
                          <strong className="num">{count} Orders</strong> ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--w-200)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--c-700)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Top Selling Dishes Table */}
          <Card title="Top Selling Dishes & Revenue Performance">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Dish Name</th>
                    <th className="is-num">Portions Sold</th>
                    <th className="is-num">Total Revenue (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topDishes.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No dish sales recorded for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    report.topDishes.map((dish, i) => (
                      <tr key={dish.name}>
                        <td><Badge tone="neutral">#{i + 1}</Badge></td>
                        <td><strong>{dish.name}</strong></td>
                        <td className="is-num num">{dish.quantity}</td>
                        <td className="is-num num"><strong>{formatPKR(dish.revenue)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
