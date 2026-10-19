import { getKarachiBusinessDate } from '@/lib/format'
import type { AnalysisPeriod } from './types'

export interface NormalizedQuery {
  raw: string
  normalized: string
  tokens: string[]
  detectedPeriod?: AnalysisPeriod
  comparisonPeriod?: AnalysisPeriod
}

/**
 * Returns Date strings in YYYY-MM-DD for Asia/Karachi timezone
 */
export function createPeriod(start: Date, end: Date, label: string): AnalysisPeriod {
  const sStr = getKarachiBusinessDate(start)
  const eStr = getKarachiBusinessDate(end)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  return { start: sStr, end: eStr, label, days }
}

export function getDefaultPeriod(key: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' = 'today'): {
  period: AnalysisPeriod
  comparisonPeriod: AnalysisPeriod
} {
  const now = new Date()

  if (key === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const dayBefore = new Date(yest)
    dayBefore.setDate(dayBefore.getDate() - 1)

    return {
      period: createPeriod(yest, yest, 'Yesterday'),
      comparisonPeriod: createPeriod(dayBefore, dayBefore, 'Day Before Yesterday'),
    }
  }

  if (key === 'week' || key === 'last_week') {
    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - 6)

    const prevWeekStart = new Date(startOfWeek)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(startOfWeek)
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)

    return {
      period: createPeriod(startOfWeek, now, 'Last 7 Days'),
      comparisonPeriod: createPeriod(prevWeekStart, prevWeekEnd, 'Previous 7 Days'),
    }
  }

  if (key === 'month') {
    const startOfMonth = new Date(now)
    startOfMonth.setDate(startOfMonth.getDate() - 29)

    const prevMonthStart = new Date(startOfMonth)
    prevMonthStart.setDate(prevMonthStart.getDate() - 30)
    const prevMonthEnd = new Date(startOfMonth)
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1)

    return {
      period: createPeriod(startOfMonth, now, 'Last 30 Days'),
      comparisonPeriod: createPeriod(prevMonthStart, prevMonthEnd, 'Previous 30 Days'),
    }
  }

  // Today (default)
  const yest = new Date(now)
  yest.setDate(yest.getDate() - 1)

  return {
    period: createPeriod(now, now, 'Today'),
    comparisonPeriod: createPeriod(yest, yest, 'Yesterday'),
  }
}

/**
 * Normalizes input text and extracts restaurant/date parameters
 */
export function normalizeQuery(raw: string): NormalizedQuery {
  const cleaned = (raw || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned.split(' ').filter(Boolean)

  let detectedPeriod: AnalysisPeriod | undefined
  let comparisonPeriod: AnalysisPeriod | undefined

  if (cleaned.includes('yesterday') || cleaned.includes('kal')) {
    const p = getDefaultPeriod('yesterday')
    detectedPeriod = p.period
    comparisonPeriod = p.comparisonPeriod
  } else if (cleaned.includes('this week') || cleaned.includes('last 7 days') || cleaned.includes('past week') || cleaned.includes('hafta')) {
    const p = getDefaultPeriod('week')
    detectedPeriod = p.period
    comparisonPeriod = p.comparisonPeriod
  } else if (cleaned.includes('this month') || cleaned.includes('last 30 days') || cleaned.includes('month') || cleaned.includes('mahina')) {
    const p = getDefaultPeriod('month')
    detectedPeriod = p.period
    comparisonPeriod = p.comparisonPeriod
  } else if (cleaned.includes('today') || cleaned.includes('aaj')) {
    const p = getDefaultPeriod('today')
    detectedPeriod = p.period
    comparisonPeriod = p.comparisonPeriod
  }

  return {
    raw,
    normalized: cleaned,
    tokens,
    detectedPeriod,
    comparisonPeriod,
  }
}
