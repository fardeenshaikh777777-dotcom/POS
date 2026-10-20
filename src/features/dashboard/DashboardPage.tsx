import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState, ErrorState } from '@/components/ui'
import { formatPKR, getKarachiBusinessDate } from '@/lib/format'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchCompleteDashboardData,
  type DashboardDetails,
  type DashboardDateRange,
} from './api'
import { OperationalCostChart } from './OperationalCostChart'

interface GaugeSegment {
  value: number
  color: string
}

// Mathematically exact semicircle segmented arc generator with clean gap spacing
function renderSemicircleSegments({
  cx,
  cy,
  r,
  strokeWidth,
  segments,
  gapDeg = 4,
}: {
  cx: number
  cy: number
  r: number
  strokeWidth: number
  segments: GaugeSegment[]
  gapDeg?: number
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  if (total <= 0) return null

  const activeSegments = segments.filter((s) => s.value > 0)
  const totalGaps = activeSegments.length > 1 ? (activeSegments.length - 1) * gapDeg : 0
  const availableDeg = Math.max(0, 180 - totalGaps)

  let currentAngleDeg = 180 // Start from left (9 o'clock)

  return activeSegments.map((seg, idx) => {
    const spanDeg = (seg.value / total) * availableDeg
    if (spanDeg <= 0.2) return null

    const startAngle = (currentAngleDeg * Math.PI) / 180
    const endAngle = ((currentAngleDeg - spanDeg) * Math.PI) / 180

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy - r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy - r * Math.sin(endAngle)

    const largeArc = spanDeg > 180 ? 1 : 0
    const pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`

    currentAngleDeg = currentAngleDeg - spanDeg - gapDeg

    return (
      <path
        key={idx}
        d={pathD}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    )
  })
}

export function DashboardPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  // Default date filter is TODAY as explicitly required by user
  const [dateRange, setDateRange] = useState<DashboardDateRange>('today')
  const [customDate, setCustomDate] = useState<string>(getKarachiBusinessDate())
  const [posPeriod, setPosPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [data, setData] = useState<DashboardDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Real-time second-by-second Karachi live clock
  const [liveClock, setLiveClock] = useState<string>('')
  const [liveDateStr, setLiveDateStr] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      try {
        setLiveClock(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).format(now)
        )
        setLiveDateStr(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).format(now)
        )
      } catch {
        setLiveClock(now.toLocaleTimeString())
        setLiveDateStr(getKarachiBusinessDate(now))
      }
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCompleteDashboardData(
        branchId,
        dateRange,
        dateRange === 'custom' ? customDate : undefined
      )
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, dateRange, customDate])

  useEffect(() => {
    loadData()

    const handleUpdate = () => {
      loadData()
    }

    // Reactive event subscriptions: local storage events + multi-tab synchronization
    window.addEventListener('karachi_storage_update', handleUpdate)
    window.addEventListener('karachi-pos-update', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('focus', handleUpdate)

    // Polling fallback every 6 seconds so live sales, drawer cash, and kitchen tickets stay synced
    const interval = setInterval(handleUpdate, 6000)

    // Supabase Realtime subscription
    let channel: ReturnType<typeof supabase.channel> | null = null
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`dashboard_realtime_${branchId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, handleUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions' }, handleUpdate)
        .subscribe()
    }

    return () => {
      window.removeEventListener('karachi_storage_update', handleUpdate)
      window.removeEventListener('karachi-pos-update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
      clearInterval(interval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadData, branchId])

  if (loading) {
    return <LoadingState label="Calculating real-time analytics…" />
  }

  if (error || !data) {
    return <ErrorState error={error || 'Failed to load dashboard'} onRetry={loadData} />
  }

  const {
    metrics,
    salesOrderTypes,
    trendingDish,
    posActivity,
    topCategories,
    recentOrders,
    liveCurrentStatus,
    dateFilterInfo,
  } = data

  const isTodayActive = dateRange === 'today'
  const isCustomActive = dateRange === 'custom'

  return (
    <div className="dash-container">
      {/* 1. LIVE OPERATIONS PULSE BAR (Always displays real-time current status right now) */}
      <section className="live-pulse-card" aria-label="Real-Time Restaurant Operations">
        <div className="live-pulse-top">
          <div className="live-beacon">
            <span className="live-beacon-dot" />
            <span>Live Restaurant Operations · Clifton Branch</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="live-clock-badge" title="Karachi Live Time">
              <span>🕒</span>
              <span>{liveClock || liveCurrentStatus.karachiTime}</span>
              <span style={{ color: '#94A3B8', fontSize: '11px' }}>PKT</span>
            </div>
            <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>
              {liveDateStr || liveCurrentStatus.karachiDate}
            </span>
          </div>
        </div>

        {/* Real-time Current Metrics Grid */}
        <div className="live-metrics-grid">
          {/* Live Today's Revenue */}
          <div className="live-metric-pill" style={{ borderLeft: '3px solid #10B981' }}>
            <span className="live-metric-label">Today's Live Sales</span>
            <span className="live-metric-val">{formatPKR(liveCurrentStatus.todaySales)}</span>
            <span className="live-metric-sub">
              {liveCurrentStatus.todayOrdersCount} orders placed today
            </span>
          </div>

          {/* Active Till Cash */}
          <Link
            to="/cash"
            className="live-metric-pill"
            style={{ borderLeft: '3px solid #F59E0B' }}
            title="Click to view Cash Drawer session"
          >
            <span className="live-metric-label">Drawer Till Cash ⟶</span>
            <span className="live-metric-val">{formatPKR(liveCurrentStatus.activeDrawerCash)}</span>
            <span className="live-metric-sub" style={{ color: liveCurrentStatus.activeCashSessionId ? '#34D399' : '#FBBF24' }}>
              {liveCurrentStatus.activeCashSessionId ? '● Active Session Open' : '○ Till Closed'}
            </span>
          </Link>

          {/* Kitchen Orders In Queue */}
          <Link
            to="/kitchen"
            className="live-metric-pill"
            style={{ borderLeft: '3px solid #FF5B26' }}
            title="Click to open Kitchen KDS"
          >
            <span className="live-metric-label">Kitchen Queue ⟶</span>
            <span className="live-metric-val">
              {liveCurrentStatus.kitchenPendingCount}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginLeft: '4px' }}>Tickets</span>
            </span>
            <span className="live-metric-sub">
              {liveCurrentStatus.kitchenPendingCount > 0 ? '🔥 Cooking & Pending' : '✓ Kitchen All Clear'}
            </span>
          </Link>

          {/* Dining Tables Floor Occupancy */}
          <Link
            to="/tables"
            className="live-metric-pill"
            style={{ borderLeft: '3px solid #3B82F6' }}
            title="Click to view Floor Tables"
          >
            <span className="live-metric-label">Floor Tables ⟶</span>
            <span className="live-metric-val">
              {liveCurrentStatus.occupiedTablesCount}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginLeft: '4px' }}>
                / {liveCurrentStatus.totalTablesCount}
              </span>
            </span>
            <span className="live-metric-sub">
              {liveCurrentStatus.occupiedTablesCount > 0
                ? `${Math.round((liveCurrentStatus.occupiedTablesCount / Math.max(liveCurrentStatus.totalTablesCount, 1)) * 100)}% Seated`
                : 'All Tables Free'}
            </span>
          </Link>
        </div>

        {/* Mobile Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <Link
            to="/pos"
            className="btn btn--primary"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚡ Take New Order (POS)
          </Link>
          <Link
            to="/cash"
            className="btn btn--secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            💵 Pay In / Out
          </Link>
          <Link
            to="/kitchen"
            className="btn btn--secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            🍳 Kitchen KDS
          </Link>
        </div>
      </section>

      {/* 2. DATE FILTER & ANALYSIS TOOLBAR (Filter sales by Today, Yesterday, Specific Date, Week, Month) */}
      <section className="date-toolbar" aria-label="Date Analysis Range">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
              Sales & Performance Analysis
            </span>
            {isTodayActive ? (
              <span className="badge badge--ok" style={{ fontSize: '11px', padding: '2px 8px' }}>
                🟢 Today's Live Sales
              </span>
            ) : (
              <span className="badge" style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--c-100)', color: 'var(--text)' }}>
                📅 {dateFilterInfo?.label || 'Selected Range'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isTodayActive
              ? `Displaying today's sales and real-time operations (${getKarachiBusinessDate()}).`
              : `All sales figures, orders, and charts below reflect: ${dateFilterInfo?.label}.`}
          </div>
        </div>

        {/* Segmented Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="date-chips-wrap">
            <button
              type="button"
              className={`date-chip-btn ${dateRange === 'today' ? 'active' : ''}`}
              onClick={() => setDateRange('today')}
            >
              🟢 Today
            </button>
            <button
              type="button"
              className={`date-chip-btn ${dateRange === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDateRange('yesterday')}
            >
              ⏪ Yesterday
            </button>
            <button
              type="button"
              className={`date-chip-btn ${dateRange === 'week' ? 'active' : ''}`}
              onClick={() => setDateRange('week')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`date-chip-btn ${dateRange === 'month' ? 'active' : ''}`}
              onClick={() => setDateRange('month')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`date-chip-btn ${isCustomActive ? 'active' : ''}`}
              onClick={() => setDateRange('custom')}
            >
              📅 Pick Date
            </button>
          </div>

          {/* Specific Calendar Date Picker */}
          {isCustomActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={customDate}
                max={getKarachiBusinessDate()}
                onChange={(e) => setCustomDate(e.target.value)}
                className="input"
                style={{
                  height: '34px',
                  minHeight: '34px',
                  padding: '0 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                }}
                aria-label="Select custom date"
              />
            </div>
          )}

          {/* Jump Back to Today button */}
          {!isTodayActive && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setDateRange('today')}
              style={{ fontSize: '11px', color: 'var(--orange-500)', fontWeight: 700 }}
            >
              ↺ Reset to Today
            </button>
          )}
        </div>
      </section>

      {/* 3. KEY PERFORMANCE INDICATORS ROW (Dynamically computed for chosen date) */}
      <section className="kpi-row" aria-label="Key Performance Indicators">
        {/* Card 1: Total Orders */}
        <div className="kpi-card kpi-card--primary">
          <div className="kpi-head">
            <span className="kpi-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </span>
            <span className="kpi-label">Total Orders</span>
          </div>
          <div className="kpi-value">{metrics.total_orders}</div>
          <div className="kpi-pill">
            <span>{isTodayActive ? 'Today’s Bills' : dateFilterInfo.label}</span>
          </div>
        </div>

        {/* Card 2: Total Delivered */}
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon" style={{ color: 'var(--c-600)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                <path d="M15 18H9" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
              </svg>
            </span>
            <span className="kpi-label">Completed / Served</span>
          </div>
          <div className="kpi-value">{metrics.completed_orders}</div>
          <div className="kpi-pill kpi-pill--ok">
            <span>
              {metrics.total_orders > 0
                ? `${Math.round((metrics.completed_orders / metrics.total_orders) * 100)}% Fulfilled`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Card 3: Canceled Order */}
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon" style={{ color: 'var(--c-600)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </span>
            <span className="kpi-label">Canceled Orders</span>
          </div>
          <div className="kpi-value">{metrics.cancelled_orders}</div>
          <div className="kpi-pill kpi-pill--danger">
            <span>
              {metrics.cancelled_orders > 0 ? `${metrics.cancelled_orders} Voided` : '0 Voided'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Revenue (PKR Currency) */}
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon" style={{ color: 'var(--c-600)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </span>
            <span className="kpi-label">{isTodayActive ? "Today's Net Revenue" : 'Net Revenue'}</span>
          </div>
          <div className="kpi-value num">
            {formatPKR(metrics.net_sales)}
          </div>
          <div className="kpi-pill kpi-pill--ok">
            <span>Avg {formatPKR(metrics.average_order_value)} / bill</span>
          </div>
        </div>

        {/* Card 5: Net Operating Profit */}
        {(() => {
          const netProfit = metrics.net_sales - metrics.total_expenses
          const margin = metrics.net_sales > 0 ? Math.round((netProfit / metrics.net_sales) * 100) : 0
          const isProfitable = netProfit >= 0
          return (
            <div className="kpi-card" style={{ border: '2px solid var(--ok, #10B981)', background: 'var(--surface)' }}>
              <div className="kpi-head">
                <span className="kpi-icon" style={{ color: 'var(--ok, #10B981)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <span className="kpi-label" style={{ fontWeight: 700, color: 'var(--text)' }}>Net Operating Profit</span>
              </div>
              <div className="kpi-value num" style={{ color: isProfitable ? 'var(--ok, #10B981)' : 'var(--danger)' }}>
                {formatPKR(netProfit)}
              </div>
              <div className={`kpi-pill ${isProfitable ? 'kpi-pill--ok' : 'kpi-pill--danger'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points={isProfitable ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                </svg>
                <span>{margin >= 0 ? `+${margin}% Margin` : `${margin}% Margin`}</span>
              </div>
            </div>
          )
        })()}
      </section>

      {/* 4. MAIN ANALYTICS ROW: Spline Chart + POS Activities */}
      <section className="dash-row-analytics" aria-label="Operational Analytics & Sales">
        {/* Operational Cost Vs Revenue Spline & Histogram Card */}
        <OperationalCostChart
          trendData={data.trendData}
          netSales={metrics.net_sales}
          dateRange={dateRange}
          onDateRangeChange={(val) => setDateRange(val)}
          dateLabel={dateFilterInfo?.label}
        />

        {/* POS Activities Card */}
        <div className="pos-activity-card">
          {(() => {
            const currentPos = data.posActivities?.[posPeriod] || posActivity

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>POS Activities</h2>
                  <select
                    value={posPeriod}
                    onChange={(e) => setPosPeriod(e.target.value as 'today' | 'week' | 'month')}
                    className="input"
                    style={{
                      minHeight: '26px',
                      height: '26px',
                      padding: '0 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                    aria-label="Filter POS activities time range"
                  >
                    <option value="today">Today's</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Total Counter Sales</span>
                  <span>⟶</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 14px 0' }}>
                  <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                    {formatPKR(currentPos.todaySales)}
                  </span>
                  <span className="badge badge--ok" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    {posPeriod === 'today' ? 'Live Today' : posPeriod === 'week' ? 'Past 7 Days' : 'This Month'}
                  </span>
                </div>

                {/* 3 Metric Pills: Total Bills, AVG Value, Peak Hour */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Bills</span>
                    <div className="num" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{currentPos.totalBills}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AVG Value</span>
                    <div className="num" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{formatPKR(currentPos.avgValue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Peak Hour</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>{currentPos.peakHour}</div>
                  </div>
                </div>

                {/* Payment Method Radial Gauge */}
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Payment Method Breakdown
                  </div>

                  <div style={{ width: '100%', height: '95px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <svg viewBox="0 0 160 88" style={{ width: '160px', height: '88px', overflow: 'visible' }}>
                      {/* Background Track */}
                      <path
                        d="M 24 74 A 56 56 0 0 1 136 74"
                        fill="none"
                        stroke="var(--c-200)"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      {renderSemicircleSegments({
                        cx: 80,
                        cy: 74,
                        r: 56,
                        strokeWidth: 10,
                        segments: [
                          { value: currentPos.cashPct, color: '#FF5B26' }, // Cash: Orange
                          { value: currentPos.cardPct, color: '#374151' }, // Card: Dark charcoal
                          { value: currentPos.onlinePct, color: '#10B981' }, // JazzCash/Easypaisa: Emerald
                        ],
                      })}
                    </svg>

                    {/* Center Percentage Display */}
                    <div style={{ position: 'absolute', bottom: '6px', textAlign: 'center' }}>
                      <span className="num" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                        {currentPos.cashPct}%
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Cash Share
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Legend */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '4px', fontSize: '11px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF5B26' }} />
                      Cash ({currentPos.cashPct}%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#374151' }} />
                      Card ({currentPos.cardPct}%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                      Mobile ({currentPos.onlinePct}%)
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* 5. LOWER OPERATIONAL ROW: Stream of Orders & Metrics */}
      <section className="dash-row-bottom" aria-label="Recent Orders and Operations">
        {/* Stream of Orders for the selected period */}
        <div className="recent-orders-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {isTodayActive ? "Today's Orders" : `Orders (${dateFilterInfo?.label})`}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Live order dispatch and customer ticket ledger
              </span>
            </div>
            <Link to="/orders" className="btn btn--secondary btn--sm">
              View All Orders ⟶
            </Link>
          </div>

          <div className="recent-orders-list">
            {recentOrders.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No orders recorded for this period. Click "+ Take New Order" to start!
              </div>
            ) : (
              recentOrders.map((order) => {
                const statusTone =
                  order.status === 'completed'
                    ? 'badge--ok'
                    : order.status === 'cancelled'
                    ? 'badge--danger'
                    : 'badge--accent'
                return (
                  <div key={order.id} className="recent-order-row">
                    <div className="recent-order-left">
                      <div className="recent-dish-img-wrap">
                        <img
                          src={order.dishImage}
                          alt={order.dishName}
                          className="recent-dish-img"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src =
                              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="%23FFEFEA"/><text x="22" y="26" font-size="20" text-anchor="middle">🍲</text></svg>'
                          }}
                        />
                      </div>
                      <div className="recent-order-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                            {order.orderNumber}
                          </span>
                          <span className={`badge ${statusTone}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {order.dishName} · {order.orderType}
                        </div>
                      </div>
                    </div>

                    <div className="recent-order-right">
                      <span className="num" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                        {formatPKR(order.price)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {order.timeAgo}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Side Stack: Trending Dish & Top Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Trending Dish Card */}
          <div className="trending-dish-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--orange-500)', letterSpacing: '0.04em' }}>
                ⭐ #1 Top Selling Item
              </span>
              <span className="badge badge--ok" style={{ fontSize: '10px' }}>
                {trendingDish.orderCount} Sold
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, background: 'var(--c-100)' }}>
                <img
                  src={trendingDish.image}
                  alt={trendingDish.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%23FFEFEA"/><text x="28" y="34" font-size="24" text-anchor="middle">🍲</text></svg>'
                  }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 2px 0' }}>
                  {trendingDish.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {trendingDish.category} · {formatPKR(trendingDish.price)}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Order Types Breakdown */}
          <div className="stat-card" style={{ padding: '14px 16px' }}>
            <span className="stat-card__label" style={{ fontWeight: 700, color: 'var(--text)' }}>
              Channel Distribution
            </span>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
              <div style={{ flex: 1, padding: '8px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Dine-In</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{salesOrderTypes.dineInPct}%</div>
              </div>
              <div style={{ flex: 1, padding: '8px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Takeaway</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{salesOrderTypes.pickupPct}%</div>
              </div>
              <div style={{ flex: 1, padding: '8px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Delivery</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{salesOrderTypes.deliveryPct}%</div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="stat-card" style={{ padding: '14px 16px' }}>
            <span className="stat-card__label" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
              Top Food Categories
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topCategories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{cat.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: 'var(--c-200)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.percentage}%`, height: '100%', background: 'var(--orange-500)' }} />
                    </div>
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
