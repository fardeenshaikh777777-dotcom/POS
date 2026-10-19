import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Badge, LoadingState } from '@/components/ui'
import { SUGGESTED_QUESTIONS } from './intelligence/intentRegistry'
import { executeIntelligenceQuery } from './intelligence/intelligenceEngine'
import { fetchOperationalContext, clearOperationalContextCache } from './api'
import type { OperationalContext, AiAnalysisResult } from './intelligence/types'
import { formatPKR } from '@/lib/format'

type PeriodOption = 'today' | 'yesterday' | 'week' | 'month'

export function AiManagerPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'
  const userRole = profile?.role || 'owner'

  const [period, setPeriod] = useState<PeriodOption>('today')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [context, setContext] = useState<OperationalContext | null>(null)
  const [result, setResult] = useState<AiAnalysisResult | null>(null)
  const [history, setHistory] = useState<string[]>([
    "Why are today's sales lower than yesterday's?",
    'Which menu items have the highest estimated contribution margin?',
    'Which ingredients are below their reorder thresholds?',
  ])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const ctx = await fetchOperationalContext(branchId, userRole, period)
        if (cancelled) return
        setContext(ctx)
        setResult((prev) => {
          const q = prev?.title || "Why are today's sales lower than yesterday's?"
          return executeIntelligenceQuery(q, ctx)
        })
      } catch (err) {
        console.error('Failed to load operational context', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [branchId, userRole, period])

  const handleRefresh = async () => {
    clearOperationalContextCache()
    setLoading(true)
    try {
      const ctx = await fetchOperationalContext(branchId, userRole, period)
      setContext(ctx)
      setResult((prev) => {
        if (!prev) return executeIntelligenceQuery("Why are today's sales lower than yesterday's?", ctx)
        return executeIntelligenceQuery(query || prev.title, ctx)
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAsk = (questionText: string) => {
    const q = questionText.trim()
    if (!q || !context) return
    setQuery(q)
    setAnalyzing(true)

    // Push to history
    setHistory((prev) => [q, ...prev.filter((item) => item !== q)].slice(0, 8))

    setTimeout(() => {
      const res = executeIntelligenceQuery(q, context)
      setResult(res)
      setAnalyzing(false)
    }, 80)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleAsk(query)
  }

  // Filter suggested questions permitted for role
  const filteredSuggestions = useMemo(() => {
    return SUGGESTED_QUESTIONS.filter(
      (sq) => !sq.requiredRole || sq.requiredRole.includes(userRole)
    )
  }, [userRole])

  // Quick Pulse Metrics from Context
  const pulseMetrics = useMemo(() => {
    if (!context) return null
    const nonCancelled = (context.orders || []).filter((o) => o.status !== 'cancelled')
    const netSales = nonCancelled.reduce((acc, o) => acc + (o.total || 0), 0)
    const lowStockCount = (context.inventory || []).filter((i) => i.current_qty <= i.reorder_level).length
    const occupiedTables = (context.tables || []).filter((t) => Boolean(t.current_order_id)).length
    const totalTables = context.tables?.length || 0

    return {
      netSales,
      orderCount: nonCancelled.length,
      lowStockCount,
      occupiedTables,
      totalTables,
      hasSession: Boolean(context.activeCashSession),
    }
  }, [context])

  return (
    <div className="ai-manager-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', paddingBottom: 'var(--s-7)' }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0 }}>
              AI Restaurant Manager
            </h2>
            <Badge tone="ok">Free Rule-Based Intelligence</Badge>
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: '4px' }}>
            Explainable operational intelligence, verified formulas, and transparent financial insights — zero AI API cost.
          </p>
        </div>

        {/* Date Filter & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <div className="btn-group" style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
            <button
              type="button"
              className={`btn btn--sm ${period === 'today' ? 'btn--accent' : 'btn--ghost'}`}
              onClick={() => setPeriod('today')}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Today
            </button>
            <button
              type="button"
              className={`btn btn--sm ${period === 'yesterday' ? 'btn--accent' : 'btn--ghost'}`}
              onClick={() => setPeriod('yesterday')}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`btn btn--sm ${period === 'week' ? 'btn--accent' : 'btn--ghost'}`}
              onClick={() => setPeriod('week')}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`btn btn--sm ${period === 'month' ? 'btn--accent' : 'btn--ghost'}`}
              onClick={() => setPeriod('month')}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Last 30 Days
            </button>
          </div>

          <Button
            size="sm"
            variant="default"
            onClick={handleRefresh}
            loading={loading}
            title="Refresh database records"
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* Business Health Pulse Cards */}
      {pulseMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--s-3)' }}>
          <div className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recorded Net Sales ({period.toUpperCase()})
            </span>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>
              {formatPKR(pulseMetrics.netSales)}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pulseMetrics.orderCount} valid bills
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cash Drawer Session
            </span>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: pulseMetrics.hasSession ? 'var(--ok)' : 'var(--warn)' }}>
              {pulseMetrics.hasSession ? 'Shift Active' : 'No Open Session'}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pulseMetrics.hasSession ? 'Counter till recording collections' : 'Shift start float required'}
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Low Stock Alert
            </span>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: pulseMetrics.lowStockCount > 0 ? 'var(--danger)' : 'var(--ok)' }}>
              {pulseMetrics.lowStockCount} Item{pulseMetrics.lowStockCount === 1 ? '' : 's'}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pulseMetrics.lowStockCount > 0 ? 'Below safety reorder threshold' : 'All ingredients healthy'}
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Table Floor Utilization
            </span>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>
              {pulseMetrics.occupiedTables} / {pulseMetrics.totalTables} Seated
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pulseMetrics.totalTables > 0 ? `${Math.round((pulseMetrics.occupiedTables / pulseMetrics.totalTables) * 100)}% floor occupancy` : 'Layout setup'}
            </span>
          </div>
        </div>
      )}

      {/* Natural Language Query Bar */}
      <div className="card" style={{ padding: 'var(--s-4)', borderLeft: '4px solid var(--orange-500)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything: e.g. 'Why did sales drop?', 'Best selling dishes', 'Low stock', 'Contribution margin'…"
              style={{
                width: '100%',
                paddingLeft: '14px',
                paddingRight: '36px',
                fontSize: 'var(--fs-sm)',
                height: '44px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
              }}
              disabled={loading}
              aria-label="Ask restaurant operational question"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={analyzing}
            style={{ height: '44px', padding: '0 20px', whiteSpace: 'nowrap' }}
          >
            Analyze Operations
          </Button>
        </form>

        {/* Suggested Inquiries (Pills) */}
        <div style={{ marginTop: 'var(--s-3)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Suggested Inquiries for {userRole.toUpperCase()}:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {filteredSuggestions.map((sq) => (
              <button
                key={sq.id}
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => handleAsk(sq.text)}
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  background: query === sq.text ? 'var(--orange-100)' : 'var(--surface-muted)',
                  color: query === sq.text ? 'var(--orange-700)' : 'var(--text)',
                }}
              >
                {sq.text}
              </button>
            ))}
          </div>
        </div>

        {/* History Chips */}
        {history.length > 0 && (
          <div style={{ marginTop: 'var(--s-3)', paddingTop: 'var(--s-2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Recent inquiries:</span>
            {history.slice(0, 4).map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAsk(h)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Response Area */}
      {loading && <LoadingState label="Computing deterministic metrics and aggregating restaurant records…" />}

      {!loading && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          {/* Main Finding & Structured Answer Card */}
          <div className="card" style={{ padding: 'var(--s-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--s-2)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--s-3)' }}>
              <div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--orange-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Operational Intelligence Finding
                </span>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text)' }}>
                  {result.title}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
                <Badge tone={result.confidence === 'high' ? 'ok' : result.confidence === 'medium' ? 'neutral' : 'warn'}>
                  {result.confidence === 'high' ? 'High Confidence' : result.confidence === 'medium' ? 'Moderate Confidence' : 'Limited Data'}
                </Badge>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Period: {result.sourcePeriod.label} ({result.sourcePeriod.start} to {result.sourcePeriod.end})
                </span>
              </div>
            </div>

            {/* Answer Paragraph */}
            <div style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-md)', lineHeight: 1.6, color: 'var(--text)' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {result.answer}
              </p>
            </div>

            {/* Metrics Grid */}
            {result.metrics && result.metrics.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--s-3)', marginTop: 'var(--s-4)' }}>
                {result.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--s-3)',
                      background: 'var(--surface-muted)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {m.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>
                        {m.value}
                      </span>
                      {m.change && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: m.change.startsWith('+') ? 'var(--ok)' : m.change.startsWith('-') ? 'var(--danger)' : 'var(--text-muted)',
                          }}
                        >
                          {m.change}
                        </span>
                      )}
                    </div>
                    {m.helper && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {m.helper}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence and Reason Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--s-4)' }}>
            {/* Evidence Card */}
            <div className="card" style={{ padding: 'var(--s-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                <span style={{ fontSize: '16px' }}>📊</span>
                <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0 }}>
                  Empirical Evidence & Baseline
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
                {result.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--s-2) var(--s-3)',
                      borderLeft: '2px solid var(--border-strong)',
                      background: 'var(--surface-muted)',
                      borderRadius: '0 var(--radius-xs) var(--radius-xs) 0',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                      {ev.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deterministic Reason / Rule Card */}
            <div className="card" style={{ padding: 'var(--s-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                <span style={{ fontSize: '16px' }}>📐</span>
                <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0 }}>
                  Mathematical Rule & Formula
                </h4>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, background: 'var(--surface-muted)', padding: 'var(--s-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'block', color: 'var(--c-800)', wordBreak: 'break-word' }}>
                  {result.reason}
                </code>
              </div>

              <div style={{ marginTop: 'var(--s-3)' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Audit Limitations & Data Scope:
                </span>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {result.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                  <li>Data sample size: {result.dataQuality.sampleCount} audited records.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations with Direct Deep-Links */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="card" style={{ padding: 'var(--s-4)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                <span style={{ fontSize: '16px' }}>⚡</span>
                <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0 }}>
                  Practical Operational Recommendations
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--s-3)' }}>
                {result.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--s-3)',
                      background: 'var(--surface-muted)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 'var(--s-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                        {rec.actionText}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {rec.explanation}
                      </p>
                    </div>

                    {rec.targetRoute && (
                      <div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => navigate(rec.targetRoute!)}
                          style={{ fontSize: '12px', width: '100%' }}
                        >
                          → {rec.routeLabel || 'Open Module'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
