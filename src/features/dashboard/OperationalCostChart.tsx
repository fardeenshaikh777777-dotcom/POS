import React, { useState, useMemo, useRef, useCallback } from 'react'
import { formatPKR } from '@/lib/format'
import type { DashboardDateRange } from './api'

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

export interface OperationalCostChartProps {
  trendData?: Array<{
    label: string
    sales: number
    cost: number
    profit?: number
  }>
  netSales: number
  dateRange: DashboardDateRange
  onDateRangeChange: (range: DashboardDateRange) => void
  dateLabel?: string
}

export const OperationalCostChart = React.memo(function OperationalCostChart({
  trendData = [],
  netSales,
  dateRange,
  onDateRangeChange,
  dateLabel,
}: OperationalCostChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(
    dateRange === 'week' ? 4 : (dateRange === 'today' || dateRange === 'yesterday') ? 5 : 2
  )
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Memoize geometry calculations so cursor tracking does not recompute them
  const { mappedPoints, salesSpline, costSpline, maxVal } = useMemo(() => {
    const points = trendData.length > 0 ? trendData : []
    const max = Math.max(...points.map((d) => Math.max(d.sales, d.cost)), 1000) * 1.25

    const mapped = points.map((d, i) => {
      const x = 114 + (i / Math.max(points.length - 1, 1)) * 612
      const salesY = 195 - (d.sales / max) * 160
      const costY = 195 - (d.cost / max) * 160
      return { ...d, x, salesY, costY }
    })

    const sSpline = buildSmoothSpline(mapped.map((p) => ({ x: p.x, y: p.salesY })))
    const cSpline = buildSmoothSpline(mapped.map((p) => ({ x: p.x, y: p.costY })))

    return { mappedPoints: mapped, salesSpline: sSpline, costSpline: cSpline, maxVal: max }
  }, [trendData])

  const activeIdx = hoveredIdx !== null ? hoveredIdx : Math.min(selectedIdx, Math.max(mappedPoints.length - 1, 0))
  const activePt = mappedPoints[activeIdx] || mappedPoints[0]

  const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0]
  const barW = mappedPoints.length <= 4 ? 54 : mappedPoints.length <= 7 ? 40 : 34

  // High-performance pointer tracking:
  // Converts mouse X directly to SVG coordinate and finds nearest column with ZERO dead zones.
  // Only updates state if index changes, avoiding wasteful re-renders.
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || mappedPoints.length === 0) return

    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return

    const svgX = ((e.clientX - rect.left) / rect.width) * 780

    // Boundaries of chart area
    if (svgX < 70 || svgX > 760) {
      setHoveredIdx((prev) => (prev !== null ? null : prev))
      return
    }

    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < mappedPoints.length; i++) {
      const dist = Math.abs(mappedPoints[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }

    setHoveredIdx((prev) => (prev !== closest ? closest : prev))
  }, [mappedPoints])

  const handlePointerLeave = useCallback(() => {
    setHoveredIdx(null)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || mappedPoints.length === 0) return

    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return

    const svgX = ((e.clientX - rect.left) / rect.width) * 780
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < mappedPoints.length; i++) {
      const dist = Math.abs(mappedPoints[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }
    setSelectedIdx(closest)
  }, [mappedPoints])

  // Badge layout calculations
  const badgeCostW = 76
  const badgeSalesW = 82

  let badgeCostX = 128
  let badgeSalesX = 128
  let connectorCostX = 128
  let connectorSalesX = 128
  let badgeCostY = 181
  let badgeSalesY = 181

  if (activePt) {
    const yDiff = Math.abs(activePt.salesY - activePt.costY)
    const areSameLevel = yDiff < 26

    badgeCostY = activePt.costY - 14
    badgeSalesY = activePt.salesY - 14

    if (areSameLevel) {
      // Both metrics are at virtually the same level (e.g. Rs 0 at 8 PM)
      if (activePt.x > 660) {
        // Near right edge: stack both on the left
        badgeCostX = activePt.x - badgeCostW - 12
        badgeSalesX = activePt.x - badgeSalesW - 12
        connectorCostX = activePt.x - 12
        connectorSalesX = activePt.x - 12
        badgeCostY = activePt.costY - 30
        badgeSalesY = activePt.salesY + 4
      } else if (activePt.x < 150) {
        // Near left edge: stack both on the right
        badgeCostX = activePt.x + 14
        badgeSalesX = activePt.x + 14
        connectorCostX = activePt.x + 14
        connectorSalesX = activePt.x + 14
        badgeCostY = activePt.costY - 30
        badgeSalesY = activePt.salesY + 4
      } else {
        // Clean dual badges: Cost on left, Sales on right
        badgeCostX = activePt.x - badgeCostW - 12
        badgeSalesX = activePt.x + 14
        connectorCostX = activePt.x - 12
        connectorSalesX = activePt.x + 14
      }
    } else {
      // Vertically separated
      if (activePt.x > 670) {
        badgeCostX = activePt.x - badgeCostW - 12
        badgeSalesX = activePt.x - badgeSalesW - 12
        connectorCostX = activePt.x - 12
        connectorSalesX = activePt.x - 12
      } else if (activePt.x < 150) {
        badgeCostX = activePt.x + 14
        badgeSalesX = activePt.x + 14
        connectorCostX = activePt.x + 14
        connectorSalesX = activePt.x + 14
      } else {
        badgeCostX = activePt.x - badgeCostW - 12
        badgeSalesX = activePt.x + 14
        connectorCostX = activePt.x - 12
        connectorSalesX = activePt.x + 14
      }
    }
  }

  const periodLabel = dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'Weekly' : 'Monthly'
  const displayRevenue = activePt ? activePt.sales : netSales

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Operational Cost Vs Revenue {dateLabel ? `· ${dateLabel}` : ''}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="num" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                {formatPKR(displayRevenue)}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Revenue ({periodLabel}{activePt ? ` · ${activePt.label}` : ''})
              </span>
            </div>

            {/* Live Profit & Cost Metric for Period */}
            {(() => {
              const ptCost = activePt ? activePt.cost : 0
              const ptProfit = displayRevenue - ptCost
              const margin = displayRevenue > 0 ? Math.round((ptProfit / displayRevenue) * 100) : 0
              const isPos = ptProfit >= 0
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-sunken, #F8FAFC)', padding: '5px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Cost: <strong style={{ color: '#FF5B26' }}>{formatPKR(ptCost)}</strong>
                  </span>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Net Profit: <strong style={{ color: isPos ? 'var(--ok, #10B981)' : 'var(--danger)' }}>{formatPKR(ptProfit)}</strong>
                  </span>
                  <span className={`badge ${isPos ? 'badge--ok' : 'badge--danger'}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                    {margin >= 0 ? `+${margin}% Margin` : `${margin}% Margin`}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {/* Period Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>📅</span>
            <select
              value={dateRange}
              onChange={(e) => {
                const val = e.target.value as DashboardDateRange
                onDateRangeChange(val)
                setSelectedIdx(val === 'week' ? 4 : (val === 'today' || val === 'yesterday') ? 5 : 2)
              }}
              className="input"
              style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', borderRadius: 'var(--radius)', fontWeight: 600 }}
              aria-label="Filter chart range"
            >
              <option value="today">🟢 Today (Hourly)</option>
              <option value="yesterday">⏪ Yesterday (Hourly)</option>
              <option value="week">📅 Last 7 Days (Daily)</option>
              <option value="month">🗓️ This Month (Weeks)</option>
              {dateRange === 'custom' && <option value="custom">📅 Custom Date</option>}
            </select>
          </div>

          {/* Legend: Sales Histogram (Prices) + Sells Trend + Operational Cost */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontWeight: 600, flexWrap: 'wrap' }}>
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

      {/* SVG Graph: Continuous, Lag-Free Pointer Tracking */}
      <div className="chart-svg-container" style={{ touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 780 250"
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
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

            {/* Tooltip Badges Drop Shadow */}
            <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Y-Axis Gridlines & Scaled PKR Ticks */}
          {yTicks.map((ratio) => {
            const y = 195 - ratio * 160
            const val = Math.round(maxVal * ratio)
            const label = val >= 1000 ? `Rs. ${Math.round(val / 1000)}K` : `Rs. ${val}`
            return (
              <g key={ratio} style={{ pointerEvents: 'none' }}>
                <line x1="80" y1={y} x2="755" y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
                <text x="68" y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--text-light)" fontFamily="var(--font-mono)">
                  {label}
                </text>
              </g>
            )
          })}

          {/* Background Pillar Guide Tracks for each time point */}
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
                fill={isAct ? 'rgba(255, 91, 38, 0.08)' : '#F8FAFC'}
                stroke={isAct ? 'rgba(255, 91, 38, 0.25)' : '#F1F5F9'}
                strokeWidth="1"
                style={{ pointerEvents: 'none' }}
              />
            )
          })}

          {/* Orange Histogram Bars (Prices / Sales) */}
          {mappedPoints.map((p, idx) => {
            const isAct = idx === activeIdx
            const barH = Math.max(195 - p.salesY, 6)
            const barY = 195 - barH
            return (
              <g key={`bar-group-${p.label}`} style={{ pointerEvents: 'none' }}>
                {/* Active ambient glow layer (fast GPU rendering without filter overhead) */}
                {isAct && (
                  <rect
                    x={p.x - barW / 2 - 2}
                    y={barY - 2}
                    width={barW + 4}
                    height={barH + 4}
                    rx="8"
                    fill="#EA580C"
                    opacity="0.22"
                  />
                )}
                <rect
                  x={p.x - barW / 2}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx="6"
                  fill={isAct ? 'url(#activeCapsuleGrad)' : 'url(#orangeHistGrad)'}
                  stroke={isAct ? '#EA580C' : 'rgba(234, 88, 12, 0.35)'}
                  strokeWidth={isAct ? 1.8 : 1}
                />
              </g>
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
              style={{ pointerEvents: 'none' }}
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
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Point Nodes along curves */}
          {mappedPoints.map((p, idx) => {
            const isAct = idx === activeIdx
            return (
              <g key={`nodes-${p.label}`} style={{ pointerEvents: 'none' }}>
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

          {/* Active Nodes and Badges */}
          {activePt && (
            <g style={{ pointerEvents: 'none' }}>
              {/* 1. Operational Cost Node & Floating Pill Badge */}
              <circle cx={activePt.x} cy={activePt.costY} r="5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
              <line x1={activePt.x} y1={activePt.costY} x2={connectorCostX} y2={activePt.costY} stroke="#0F172A" strokeWidth="1.5" />
              <g filter="url(#badgeShadow)">
                <rect x={badgeCostX} y={badgeCostY} width={badgeCostW} height="28" rx="8" fill="#18181B" />
                <circle cx={badgeCostX + 13} cy={badgeCostY + 14} r="4" fill="#FF5B26" />
                <text x={badgeCostX + 23} y={badgeCostY + 18} fill="#FFFFFF" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                  {activePt.cost >= 1000 ? `Rs. ${Math.round(activePt.cost / 1000)}K` : `Rs. ${activePt.cost}`}
                </text>
              </g>

              {/* 2. Sells (Revenue / Price) Node & Floating Pill Badge */}
              <circle cx={activePt.x} cy={activePt.salesY} r="5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
              <line x1={activePt.x} y1={activePt.salesY} x2={connectorSalesX} y2={activePt.salesY} stroke="#0F172A" strokeWidth="1.5" />
              <g filter="url(#badgeShadow)">
                <rect x={badgeSalesX} y={badgeSalesY} width={badgeSalesW} height="28" rx="8" fill="#18181B" />
                <circle cx={badgeSalesX + 13} cy={badgeSalesY + 14} r="4" fill="#64748B" />
                <text x={badgeSalesX + 23} y={badgeSalesY + 18} fill="#FFFFFF" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                  {activePt.sales >= 1000 ? `Rs. ${(activePt.sales / 1000).toFixed(1).replace('.0', '')}K` : `Rs. ${activePt.sales}`}
                </text>
              </g>

              {/* 3. Floating Net Profit Pill Badge */}
              {(() => {
                const profitVal = activePt.sales - activePt.cost
                const isPos = profitVal >= 0
                const badgeProfitX = Math.min(Math.max(activePt.x - 52, 75), 655)
                const topY = Math.min(activePt.costY, activePt.salesY)
                const badgeProfitY = Math.max(topY - 32, 2)
                const profitText = isPos
                  ? `Profit: +Rs. ${profitVal >= 1000 ? Math.round(profitVal / 1000) + 'K' : profitVal}`
                  : `Loss: Rs. ${Math.abs(profitVal) >= 1000 ? Math.round(profitVal / 1000) + 'K' : profitVal}`
                return (
                  <g filter="url(#badgeShadow)">
                    <rect x={badgeProfitX} y={badgeProfitY} width="104" height="22" rx="6" fill={isPos ? '#064E3B' : '#7F1D1D'} stroke={isPos ? '#10B981' : '#EF4444'} strokeWidth="1" />
                    <text x={badgeProfitX + 52} y={badgeProfitY + 15} textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">
                      {profitText}
                    </text>
                  </g>
                )
              })()}
            </g>
          )}

          {/* X-Axis Time Labels */}
          {mappedPoints.map((p, idx) => {
            const isAct = idx === activeIdx
            return (
              <text
                key={p.label}
                x={p.x}
                y="218"
                textAnchor="middle"
                fontSize={isAct ? '12' : '11'}
                fontWeight={isAct ? '800' : '600'}
                fill={isAct ? '#EA580C' : 'var(--text-light)'}
                style={{ pointerEvents: 'none' }}
              >
                {p.label}
              </text>
            )
          })}

          {/* Contiguous interactive slice rects (guarantees zero dead zones between columns) */}
          {mappedPoints.map((p, idx) => {
            const prevX = idx > 0 ? mappedPoints[idx - 1].x : 70
            const nextX = idx < mappedPoints.length - 1 ? mappedPoints[idx + 1].x : 760
            const sliceLeft = (prevX + p.x) / 2
            const sliceRight = (p.x + nextX) / 2
            const sliceW = sliceRight - sliceLeft

            return (
              <rect
                key={`slice-${p.label}`}
                x={sliceLeft}
                y="20"
                width={sliceW}
                height="220"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredIdx((prev) => (prev !== idx ? idx : prev))
                }}
                onClick={() => setSelectedIdx(idx)}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
})
