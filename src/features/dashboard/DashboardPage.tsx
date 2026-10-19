import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState, ErrorState } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchCompleteDashboardData, type DashboardDetails } from './api'

// Generate smooth cubic Bézier SVG path from discrete data points
function buildSmoothSpline(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return path
}

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

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [posPeriod, setPosPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [selectedIdx, setSelectedIdx] = useState<number>(4)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [data, setData] = useState<DashboardDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCompleteDashboardData(branchId, dateRange)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId, dateRange])

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

    // Polling fallback every 8 seconds so dashboard metrics, gauges & charts always update
    const interval = setInterval(handleUpdate, 8000)

    // Supabase Realtime subscription (if database connection is active)
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

  const { metrics, employeeStatus, salesOrderTypes, trendingDish, posActivity, topCategories, recentOrders } = data

  return (
    <div className="dash-container">
      {/* 1. TOP HORIZONTAL KPI ROW (PKR System) */}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>+10% Since last month</span>
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
            <span className="kpi-label">Total Delivered</span>
          </div>
          <div className="kpi-value">{metrics.completed_orders}</div>
          <div className="kpi-pill kpi-pill--ok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>+7.5% Since last month</span>
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
            <span className="kpi-label">Canceled Order</span>
          </div>
          <div className="kpi-value">{metrics.cancelled_orders}</div>
          <div className="kpi-pill kpi-pill--danger">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>-3.5% Since last month</span>
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
            <span className="kpi-label">Total Revenue</span>
          </div>
          <div className="kpi-value num">
            {formatPKR(metrics.net_sales)}
          </div>
          <div className="kpi-pill kpi-pill--ok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>+7.5% Since last month</span>
          </div>
        </div>
      </section>

      {/* 2. MAIN ANALYTICS ROW: Spline Chart Properly Situated (2fr) + POS Activities (1fr) */}
      <section className="dash-row-analytics" aria-label="Operational Analytics & Sales">
        {/* Operational Cost Vs Revenue Spline & Histogram Card */}
        <div className="chart-card">
          {(() => {
            const chartPoints = (data.trendData && data.trendData.length > 0) ? data.trendData : []
            const maxVal = Math.max(...chartPoints.map((d) => Math.max(d.sales, d.cost)), 1000) * 1.25

            const mappedPoints = chartPoints.map((d, i) => {
              const x = 114 + (i / Math.max(chartPoints.length - 1, 1)) * 612
              const salesY = 195 - (d.sales / maxVal) * 160
              const costY = 195 - (d.cost / maxVal) * 160
              return { ...d, x, salesY, costY }
            })

            const salesSpline = buildSmoothSpline(mappedPoints.map((p) => ({ x: p.x, y: p.salesY })))
            const costSpline = buildSmoothSpline(mappedPoints.map((p) => ({ x: p.x, y: p.costY })))

            const activeIdx = hoveredIdx !== null ? hoveredIdx : Math.min(selectedIdx, Math.max(mappedPoints.length - 1, 0))
            const activePt = mappedPoints[activeIdx] || mappedPoints[0]

            const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0]

            // Tooltip badge coordinates
            const badgeCostW = 76
            const isLeftHalf = activeIdx <= 1
            const isRightHalf = activeIdx >= mappedPoints.length - 2

            // Cost badge placed left like reference image (flipped if near left border)
            const badgeCostX = isLeftHalf ? (activePt ? activePt.x + 14 : 128) : (activePt ? activePt.x - badgeCostW - 12 : 300)
            const connectorCostX = isLeftHalf ? (activePt ? activePt.x + 14 : 128) : (activePt ? activePt.x - 12 : 300)

            // Sells badge placed right like reference image (flipped if near right border)
            const badgeSalesW = 82
            const badgeSalesX = isRightHalf ? (activePt ? activePt.x - badgeSalesW - 12 : 300) : (activePt ? activePt.x + 14 : 128)
            const connectorSalesX = isRightHalf ? (activePt ? activePt.x - 12 : 300) : (activePt ? activePt.x + 14 : 128)

            const barW = mappedPoints.length <= 4 ? 54 : (mappedPoints.length <= 7 ? 40 : 34)

            return (
              <>
                <div className="chart-header">
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      Operational Cost Vs Revenue
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                      <span className="num" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                        {formatPKR(activePt ? activePt.sales : metrics.net_sales)}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Revenue ({dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'Weekly' : 'Monthly'})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    {/* Period Selector Dropdown for single restaurant outlet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>📅</span>
                      <select
                        value={dateRange}
                        onChange={(e) => {
                          const val = e.target.value as 'today' | 'week' | 'month'
                          setDateRange(val)
                          setSelectedIdx(val === 'week' ? 4 : val === 'today' ? 5 : 2)
                        }}
                        className="input"
                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', borderRadius: 'var(--radius)', fontWeight: 600 }}
                        aria-label="Filter chart range"
                      >
                        <option value="week">Weekly (Daily)</option>
                        <option value="today">Today (Hourly)</option>
                        <option value="month">Monthly (Weeks)</option>
                      </select>
                    </div>

                    {/* Legend: Sales Histogram (Prices) + Sells Trend + Operational Cost */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EA580C' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(180deg, #FFA27B 0%, #EA580C 100%)' }} />
                        Sales Histogram (Prices)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5A6B82' }}>
                        <span style={{ width: '12px', height: '2.5px', borderRadius: '2px', background: '#5A6B82' }} />
                        Sells Trend
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FF5B26' }}>
                        <span style={{ width: '12px', height: '2.5px', borderRadius: '2px', background: '#FF5B26' }} />
                        Operational Cost
                      </span>
                    </div>
                  </div>
                </div>

                {/* SVG Graph Matching Single-Outlet Restaurant Requirements with Generous Left Clearance */}
                <div className="chart-svg-container">
                  <svg viewBox="0 0 780 250" style={{ width: '100%', height: '100%', display: 'block' }}>
                    <defs>
                      {/* Active Pillar Gradient: Soft peach top fading into rich solid vibrant orange */}
                      <linearGradient id="activeCapsuleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFA27B" stopOpacity="0.95" />
                        <stop offset="60%" stopColor="#FF7A45" stopOpacity="0.92" />
                        <stop offset="100%" stopColor="#EA580C" stopOpacity="0.98" />
                      </linearGradient>

                      {/* Standard Histogram Bar Gradient */}
                      <linearGradient id="orangeHistGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFA27B" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#FF7A45" stopOpacity="0.75" />
                      </linearGradient>

                      {/* Active Capsule Glow Filter */}
                      <filter id="activeShadow" x="-20%" y="-10%" width="140%" height="130%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.3" />
                      </filter>

                      {/* Tooltip Badges Drop Shadow */}
                      <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.35" />
                      </filter>
                    </defs>

                    {/* Y-Axis Gridlines & Scaled PKR Ticks with generous space from left */}
                    {yTicks.map((ratio) => {
                      const y = 195 - ratio * 160
                      const val = Math.round(maxVal * ratio)
                      const label = val >= 1000 ? `Rs. ${Math.round(val / 1000)}K` : `Rs. ${val}`
                      return (
                        <g key={ratio}>
                          <line x1="80" y1={y} x2="755" y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
                          <text x="68" y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--text-light)" fontFamily="var(--font-mono)">
                            {label}
                          </text>
                        </g>
                      )
                    })}

                    {/* Subtle Background Pillar Guide Tracks for each time point */}
                    {mappedPoints.map((p, idx) => {
                      const isAct = idx === activeIdx
                      const trackW = barW + 12
                      return (
                        <rect
                          key={`track-${p.label}`}
                          x={p.x - trackW / 2}
                          y={25}
                          width={trackW}
                          height={170}
                          rx="10"
                          fill={isAct ? 'rgba(255, 91, 38, 0.06)' : '#F8FAFC'}
                          stroke={isAct ? 'rgba(255, 91, 38, 0.2)' : '#F1F5F9'}
                          strokeWidth="1"
                        />
                      )
                    })}

                    {/* Real Orange Histogram Bars (Prices / Sales) for the Outlet */}
                    {mappedPoints.map((p, idx) => {
                      const isAct = idx === activeIdx
                      const barH = Math.max(195 - p.salesY, 6)
                      const barY = 195 - barH
                      return (
                        <rect
                          key={`bar-${p.label}`}
                          x={p.x - barW / 2}
                          y={barY}
                          width={barW}
                          height={barH}
                          rx="6"
                          fill={isAct ? 'url(#activeCapsuleGrad)' : 'url(#orangeHistGrad)'}
                          stroke={isAct ? '#EA580C' : 'rgba(234, 88, 12, 0.35)'}
                          strokeWidth={isAct ? 1.8 : 1}
                          filter={isAct ? 'url(#activeShadow)' : undefined}
                          style={{ transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        />
                      )
                    })}

                    {/* Operational Cost Spline Wave (Vibrant Orange) */}
                    {costSpline && (
                      <path
                        d={costSpline}
                        fill="none"
                        stroke="#FF5B26"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        className="chart-spline"
                      />
                    )}

                    {/* Sells (Revenue) Spline Wave (Slate Blue) */}
                    {salesSpline && (
                      <path
                        d={salesSpline}
                        fill="none"
                        stroke="#5A6B82"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        className="chart-spline"
                      />
                    )}

                    {/* Point Nodes along the curves */}
                    {mappedPoints.map((p, idx) => {
                      const isAct = idx === activeIdx
                      return (
                        <g key={`nodes-${p.label}`}>
                          <circle
                            cx={p.x}
                            cy={p.costY}
                            r={isAct ? 5 : 3.5}
                            fill="#FFFFFF"
                            stroke="#FF5B26"
                            strokeWidth={isAct ? 2.5 : 2}
                          />
                          <circle
                            cx={p.x}
                            cy={p.salesY}
                            r={isAct ? 5 : 3.5}
                            fill="#FFFFFF"
                            stroke="#5A6B82"
                            strokeWidth={isAct ? 2.5 : 2}
                          />
                        </g>
                      )
                    })}

                    {/* Active Nodes and Badges Matching Reference Image */}
                    {activePt && (
                      <g>
                        {/* 1. Operational Cost Node & Floating Pill Badge */}
                        <circle cx={activePt.x} cy={activePt.costY} r="5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
                        <line x1={activePt.x} y1={activePt.costY} x2={connectorCostX} y2={activePt.costY} stroke="#0F172A" strokeWidth="1.5" />
                        <g filter="url(#badgeShadow)">
                          <rect x={badgeCostX} y={activePt.costY - 14} width={badgeCostW} height="28" rx="8" fill="#18181B" />
                          <circle cx={badgeCostX + 13} cy={activePt.costY} r="4" fill="#FF5B26" />
                          <text x={badgeCostX + 23} y={activePt.costY + 4.5} fill="#FFFFFF" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                            {activePt.cost >= 1000 ? `Rs. ${Math.round(activePt.cost / 1000)}K` : `Rs. ${activePt.cost}`}
                          </text>
                        </g>

                        {/* 2. Sells (Revenue / Price) Node & Floating Pill Badge */}
                        <circle cx={activePt.x} cy={activePt.salesY} r="5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
                        <line x1={activePt.x} y1={activePt.salesY} x2={connectorSalesX} y2={activePt.salesY} stroke="#0F172A" strokeWidth="1.5" />
                        <g filter="url(#badgeShadow)">
                          <rect x={badgeSalesX} y={activePt.salesY - 14} width={badgeSalesW} height="28" rx="8" fill="#18181B" />
                          <circle cx={badgeSalesX + 13} cy={activePt.salesY} r="4" fill="#64748B" />
                          <text x={badgeSalesX + 23} y={activePt.salesY + 4.5} fill="#FFFFFF" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                            {activePt.sales >= 1000 ? `Rs. ${(activePt.sales / 1000).toFixed(1).replace('.0', '')}K` : `Rs. ${activePt.sales}`}
                          </text>
                        </g>
                      </g>
                    )}

                    {/* X-Axis Time Labels (Days / Hours / Weeks) */}
                    {mappedPoints.map((p, idx) => {
                      const isAct = idx === activeIdx
                      return (
                        <text
                          key={p.label}
                          x={p.x}
                          y="218"
                          textAnchor="middle"
                          fontSize={isAct ? "12" : "11"}
                          fontWeight={isAct ? "800" : "600"}
                          fill={isAct ? "#EA580C" : "var(--text-light)"}
                          style={{ transition: 'all 0.2s ease' }}
                        >
                          {p.label}
                        </text>
                      )
                    })}

                    {/* Interactive Hover / Click Targets */}
                    {mappedPoints.map((p, idx) => {
                      const hitW = mappedPoints.length <= 4 ? 64 : (mappedPoints.length <= 7 ? 50 : 42)
                      return (
                        <rect
                          key={`hit-${p.label}`}
                          x={p.x - hitW / 2}
                          y="20"
                          width={hitW}
                          height="220"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          onClick={() => setSelectedIdx(idx)}
                        />
                      )
                    })}
                  </svg>
                </div>
              </>
            )
          })()}
        </div>

        {/* POS Activities Card (PKR Currency + Radial Payment Gauge) */}
        <div className="pos-activity-card">
          {(() => {
            const currentPos = data.posActivities?.[posPeriod] || posActivity
            const periodGrowthText =
              posPeriod === 'today'
                ? '+12% Since Yesterday'
                : posPeriod === 'week'
                ? '+8.5% Since Last Week'
                : '+15.2% Since Last Month'

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
                    {periodGrowthText}
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
                        stroke="var(--c-100)"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      {/* Exact, mathematically calculated smooth segments */}
                      {renderSemicircleSegments({
                        cx: 80,
                        cy: 74,
                        r: 56,
                        strokeWidth: 10,
                        gapDeg: 4,
                        segments: [
                          { value: currentPos.cashPct, color: '#10B981' },
                          { value: currentPos.cardPct, color: '#F59E0B' },
                          { value: currentPos.onlinePct, color: '#3B82F6' },
                        ],
                      })}
                    </svg>

                    <div style={{ position: 'absolute', bottom: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                        {currentPos.cashPct}%
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Cash Payment
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                      Cash {currentPos.cashPct}%
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                      Card {currentPos.cardPct}%
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }} />
                      Online {currentPos.onlinePct}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          <div style={{ marginTop: '14px' }}>
            <Link to="/pos">
              <button
                className="btn btn--primary"
                style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 700 }}
              >
                Open POS & Billing
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. OPERATIONS ROW: Top Categories (1) + Employee Status (2) + Sales & Order Types (3) */}
      <section className="dash-row-ops" aria-label="Operations Status">
        {/* Top Categories Item */}
        <div className="card" style={{ padding: '18px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
            Top Categories Item
          </h2>
          <div className="cat-preview-row">
            {topCategories.map((c) => (
              <Link to="/menu" key={c.id} className="cat-preview-card">
                <img src={c.image} alt={c.name} />
                <div className="cat-preview-info">
                  <div className="cat-preview-name">{c.name}</div>
                  <div className="cat-preview-pct">{c.percentage}%</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Employee Status (Gauge Chart) */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Employee Status</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Total Employees = {employeeStatus.total}
              </div>
            </div>
            <Link to="/staff" className="btn btn--sm btn--icon" title="View Staff">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
            <div style={{ width: '130px', height: '70px', position: 'relative' }}>
              <svg viewBox="0 0 110 65" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {/* Background Track */}
                <path
                  d="M 15 54 A 40 40 0 0 1 95 54"
                  fill="none"
                  stroke="var(--c-100)"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                {/* Exact, mathematically calculated smooth segments */}
                {renderSemicircleSegments({
                  cx: 55,
                  cy: 54,
                  r: 40,
                  strokeWidth: 9,
                  gapDeg: 4,
                  segments: [
                    { value: employeeStatus.absent, color: '#EF4444' },
                    { value: employeeStatus.onBreak, color: '#F59E0B' },
                    { value: employeeStatus.onDuty, color: '#10B981' },
                  ],
                })}
                {/* Center metric indicator */}
                <text x="55" y="47" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)" fontFamily="var(--font-mono)">
                  {employeeStatus.total > 0 ? Math.round((employeeStatus.onDuty / employeeStatus.total) * 100) : 0}%
                </text>
                <text x="55" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--text-muted)" letterSpacing="0.05em">
                  ON-DUTY
                </text>
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span>On-Duty</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>— {employeeStatus.onDuty}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                <span>On-Break</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>— {employeeStatus.onBreak}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                <span>Absent</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>— {employeeStatus.absent}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales & Order Types */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Sales & Order Types</h2>
            <Link to="/orders" className="btn btn--sm btn--icon" title="View Orders">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'left' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dine-in</span>
              <div style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 6px 0', color: 'var(--text)' }}>
                {salesOrderTypes.dineInPct}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--c-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${salesOrderTypes.dineInPct}%`, height: '100%', background: '#FF5B26', borderRadius: '3px', transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Delivery</span>
              <div style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 6px 0', color: 'var(--text)' }}>
                {salesOrderTypes.deliveryPct}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--c-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${salesOrderTypes.deliveryPct}%`, height: '100%', background: '#F59E0B', borderRadius: '3px', transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pick-up</span>
              <div style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 6px 0', color: 'var(--text)' }}>
                {salesOrderTypes.pickupPct}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--c-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${salesOrderTypes.pickupPct}%`, height: '100%', background: '#FFA27B', borderRadius: '3px', transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. RECENT ORDERS (NO LOGO / NO IMAGES) + TRENDING ITEM (PKR Currency) */}
      <section className="dash-row-bottom" aria-label="Recent Operational Activity">
        {/* Recent Orders (Clean rows without dish images/logos as requested) */}
        <div className="recent-orders-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Recent Orders</h2>
            <Link to="/orders">
              <button className="btn btn--sm btn--ghost" style={{ fontSize: '11px' }}>
                View All Orders →
              </button>
            </Link>
          </div>

          {/* Clean Operational Order Rows (No logos / No images) */}
          <div className="recent-order-list">
            {(!recentOrders || recentOrders.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                  No orders recorded yet
                </div>
                <div style={{ fontSize: '12px', marginBottom: '14px' }}>
                  Place an order in POS to see real-time updates instantly.
                </div>
                <Link to="/pos" className="btn btn--sm btn--primary">
                  Open POS & Billing
                </Link>
              </div>
            ) : (
              recentOrders.map((ord) => (
                <div key={ord.id} className="recent-order-row">
                  <div className="recent-order-main">
                    <div className="recent-order-dish">
                      {ord.dishName}
                    </div>
                    <div className="recent-order-meta">
                      <strong>{ord.orderNumber}</strong> · Outlet {ord.outletNo} · {ord.orderType} · {ord.timeAgo}
                    </div>
                  </div>

                  <div className="recent-order-right">
                    <span
                      className={`badge ${
                        ord.status === 'completed'
                          ? 'badge--ok'
                          : ord.status === 'cancelled'
                          ? 'badge--danger'
                          : 'badge--warn'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {ord.status.toUpperCase()}
                    </span>
                    <span className="recent-order-price num">
                      {formatPKR(ord.price)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Selling Dishes with Real Horizontal Bar Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Top Selling Dishes</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By Volume</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metrics.top_items.map((item, idx) => {
                const maxQty = Math.max(...metrics.top_items.map((t) => t.qty_sold), 1)
                const pct = Math.round((item.qty_sold / maxQty) * 100)
                return (
                  <div key={item.item_name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                        {idx + 1}. {item.item_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.qty_sold} sold</span>
                        <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>{formatPKR(item.revenue)}</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--c-100)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: idx === 0 ? '#FF5B26' : '#F59E0B',
                          borderRadius: '3px',
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trending Menu Item Card */}
          <div className="trending-card">
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
              Trending Menu Item
            </h2>
            <img src={trendingDish.image} alt={trendingDish.name} className="trending-img" />
            <div className="trending-title">{trendingDish.name}</div>
            <div className="trending-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: '#F59E0B' }}>
                  ★ {trendingDish.rating}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {trendingDish.orderCount}
                </span>
              </div>
              <span className="num" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>
                {formatPKR(trendingDish.price)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
