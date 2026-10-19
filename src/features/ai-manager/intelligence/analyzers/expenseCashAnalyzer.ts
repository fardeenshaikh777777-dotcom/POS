import { formatPKR, roundMoney } from '@/lib/format'
import { computeCashDrawerAnalysis, calcPercentageChange } from '../metrics'
import type { OperationalContext, AiAnalysisResult } from '../types'

export function analyzeCashDiscrepancy(context: OperationalContext): AiAnalysisResult {
  const analysis = computeCashDrawerAnalysis(
    context.activeCashSession,
    context.orders,
    context.expenses
  )

  let answer: string
  let tone: 'ok' | 'warn' | 'danger' | 'neutral' = 'ok'

  if (!analysis.hasOpenSession) {
    answer = `There is currently no active open cash session recorded for branch "${context.branchName}". The drawer is currently closed or waiting for an opening float entry to initiate the shift.`
    tone = 'neutral'
  } else if (analysis.variance === undefined) {
    answer = `The active cash shift opened with a float of ${formatPKR(analysis.openingFloat)} by ${analysis.openedByName}. Recorded cash receipts stand at ${formatPKR(analysis.cashSales)} and recorded cash payouts stand at ${formatPKR(analysis.cashPayouts)}, resulting in an expected drawer balance of ${formatPKR(analysis.expectedCash)}. Physical count will be reconciled upon shift close.`
    tone = 'ok'
  } else if (analysis.variance === 0) {
    answer = `The drawer closing balance is perfectly balanced. Counted physical cash (${formatPKR(analysis.countedCash!)}) matches the expected balance (${formatPKR(analysis.expectedCash)}) exactly with zero variance.`
    tone = 'ok'
  } else if (analysis.variance < 0) {
    answer = `Cash drawer review recommended: A cash shortage of ${formatPKR(Math.abs(analysis.variance))} was recorded. Counted cash was ${formatPKR(analysis.countedCash!)} compared to an expected balance of ${formatPKR(analysis.expectedCash)} (Opening Float: ${formatPKR(analysis.openingFloat)} + Cash Sales: ${formatPKR(analysis.cashSales)} - Payouts: ${formatPKR(analysis.cashPayouts)}).`
    tone = 'warn'
  } else {
    answer = `Cash drawer review recommended: A cash overage of ${formatPKR(analysis.variance)} was recorded. Counted cash was ${formatPKR(analysis.countedCash!)} compared to an expected balance of ${formatPKR(analysis.expectedCash)}.`
    tone = 'warn'
  }

  return {
    intent: 'cash_discrepancy',
    title: 'Cash Drawer Balancing & Reconciliation',
    summary: analysis.hasOpenSession
      ? `Expected drawer balance: ${formatPKR(analysis.expectedCash)} (Float: ${formatPKR(analysis.openingFloat)}, Cash Sales: ${formatPKR(analysis.cashSales)}).`
      : 'No active cash session is currently open.',
    answer,
    metrics: [
      {
        label: 'Expected Drawer Cash',
        value: formatPKR(analysis.expectedCash),
        tone: 'accent',
        helper: `Float (${formatPKR(analysis.openingFloat)}) + Sales (${formatPKR(analysis.cashSales)}) - Out (${formatPKR(analysis.cashPayouts)})`,
      },
      {
        label: 'Opening Float',
        value: formatPKR(analysis.openingFloat),
        tone: 'neutral',
        helper: analysis.openedByName ? `Opened by ${analysis.openedByName}` : 'Shift starting cash',
      },
      {
        label: 'Cash Sales (Collected)',
        value: formatPKR(analysis.cashSales),
        tone: 'ok',
        helper: 'From succeeded cash payments',
      },
      {
        label: 'Reconciliation Variance',
        value: analysis.variance != null ? formatPKR(analysis.variance) : 'Pending Count',
        tone,
        helper: analysis.variance != null ? (analysis.variance === 0 ? 'Exact match' : analysis.variance < 0 ? 'Shortage detected' : 'Overage detected') : 'Enter count at close',
      },
    ],
    evidence: [
      {
        title: 'Opening Float Registered',
        detail: `Session opened with ${formatPKR(analysis.openingFloat)} on ${analysis.openedAt ? new Date(analysis.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'start of shift'}.`,
        figure: formatPKR(analysis.openingFloat),
      },
      {
        title: 'Cash Collections',
        detail: `Total non-cancelled orders settled in cash: ${formatPKR(analysis.cashSales)}.`,
        figure: formatPKR(analysis.cashSales),
      },
      {
        title: 'Petty Cash Payouts / Vouchers',
        detail: `Cash deducted for operational expenses: ${formatPKR(analysis.cashPayouts)}.`,
        figure: formatPKR(analysis.cashPayouts),
      },
    ],
    reason: 'Expected Cash Balance = Opening Float + Succeeded Cash Sales - Recorded Cash Payouts/Expenses. Variance = Counted Physical Cash - Expected Cash Balance. Discrepancies prompt review without attributing cause.',
    recommendations: [
      {
        actionText: 'Inspect Cash Sessions & Movements',
        explanation: 'Review the shift float, petty cash payouts, and execute shift end closing count in Cash Drawer.',
        targetRoute: '/cash',
        routeLabel: 'Open Cash Drawer',
        priority: 'high',
      },
      {
        actionText: 'Review Petty Cash Expense Vouchers',
        explanation: 'Check whether any vendor or utility payouts were made without a recorded voucher.',
        targetRoute: '/expenses',
        routeLabel: 'Open Expenses',
        priority: 'medium',
      },
    ],
    confidence: analysis.hasOpenSession ? 'high' : 'medium',
    limitations: [
      'Cash balance formula accounts strictly for transactions tagged with payment_method="cash".',
      'Card and mobile wallet transactions settle directly into bank/merchant merchant accounts and are excluded from the till.',
    ],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: analysis.hasOpenSession ? 1 : 0,
      reliability: 'complete',
      notes: analysis.hasOpenSession ? `Active session ID: ${analysis.sessionId}` : 'No active session',
    },
    generatedAt: new Date().toISOString(),
  }
}

export function analyzeExpenses(context: OperationalContext): AiAnalysisResult {
  const currentExpenses = context.expenses || []
  const previousExpenses = context.comparisonExpenses || []

  const currentTotal = roundMoney(currentExpenses.reduce((acc, e) => acc + (e.amount || 0), 0))
  const previousTotal = roundMoney(previousExpenses.reduce((acc, e) => acc + (e.amount || 0), 0))
  const expenseChange = calcPercentageChange(currentTotal, previousTotal)

  // Categorize
  const categoryMap: Record<string, number> = {}
  currentExpenses.forEach((e) => {
    const cat = e.category || 'other'
    categoryMap[cat] = roundMoney((categoryMap[cat] || 0) + (e.amount || 0))
  })

  const sortedCategories = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const topCategory = sortedCategories[0]

  const answer = currentTotal > 0
    ? `Total recorded expenses for ${context.period.label} stand at ${formatPKR(currentTotal)} across ${currentExpenses.length} vouchers (${expenseChange.text} compared to ${context.comparisonPeriod?.label || 'previous baseline'}). The largest expense category is "${topCategory ? topCategory.category : 'N/A'}" at ${formatPKR(topCategory ? topCategory.amount : 0)}.`
    : `No operational expenses have been recorded for ${context.period.label}.`

  return {
    intent: 'expense_analysis',
    title: `Operational Expenses & Overhead (${context.period.label})`,
    summary: `Total expenses: ${formatPKR(currentTotal)} (${expenseChange.text} vs baseline). Primary category: ${topCategory ? topCategory.category : 'None'}.`,
    answer,
    metrics: [
      {
        label: 'Total Expenses',
        value: formatPKR(currentTotal),
        change: expenseChange.text,
        tone: currentTotal > previousTotal ? 'warn' : 'ok',
        helper: `${currentExpenses.length} vouchers recorded`,
      },
      {
        label: 'Top Expense Category',
        value: topCategory ? topCategory.category.toUpperCase() : 'NONE',
        tone: 'accent',
        helper: topCategory ? formatPKR(topCategory.amount) : undefined,
      },
      {
        label: 'Comparison Baseline',
        value: formatPKR(previousTotal),
        tone: 'neutral',
        helper: context.comparisonPeriod?.label,
      },
    ],
    evidence: sortedCategories.map((c) => ({
      title: `Category: ${c.category.toUpperCase()}`,
      detail: `${formatPKR(c.amount)} (${currentTotal > 0 ? ((c.amount / currentTotal) * 100).toFixed(1) : 0}% of total overhead)`,
      figure: formatPKR(c.amount),
    })),
    reason: 'Calculated deterministically from recorded expense vouchers: Total Overhead = SUM(expenses.amount). Category breakdown groups entries by validated category enum.',
    recommendations: [
      {
        actionText: 'Review Expense Vouchers & Petty Cash',
        explanation: 'Inspect vendor receipts, utility bills, and petty cash payments in the Expenses ledger.',
        targetRoute: '/expenses',
        routeLabel: 'Open Expenses',
        priority: 'high',
      },
      {
        actionText: 'Reconcile With Cash Session Drawer',
        explanation: 'Verify that all cash expenses have matching vouchers linked to active cash drawer sessions.',
        targetRoute: '/cash',
        routeLabel: 'Open Cash Drawer',
        priority: 'medium',
      },
    ],
    confidence: currentExpenses.length > 0 ? 'high' : 'medium',
    limitations: ['Analysis covers recorded vouchers only; unentered invoices are excluded.'],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: currentExpenses.length,
      reliability: 'complete',
    },
    generatedAt: new Date().toISOString(),
  }
}
