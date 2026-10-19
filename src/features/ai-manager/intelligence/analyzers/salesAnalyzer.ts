import { formatPKR } from '@/lib/format'
import { computeSalesMetrics, calcPercentageChange } from '../metrics'
import type { OperationalContext, AiAnalysisResult } from '../types'

export function analyzeSales(context: OperationalContext, isComparison: boolean): AiAnalysisResult {
  const current = computeSalesMetrics(context.orders)
  const previous = computeSalesMetrics(context.comparisonOrders || [])

  const salesChange = calcPercentageChange(current.netSales, previous.netSales)
  const ordersChange = calcPercentageChange(current.totalOrders, previous.totalOrders)
  const aovChange = calcPercentageChange(current.averageOrderValue, previous.averageOrderValue)

  // Determine key factors driving sales change
  let mainDriver = 'sales activity is on par with baseline'
  if (Math.abs(ordersChange.pct) > Math.abs(aovChange.pct) && ordersChange.pct !== 0) {
    mainDriver = ordersChange.pct < 0
      ? `the decline coincides primarily with lower transaction volume (${ordersChange.text}) rather than ticket size`
      : `revenue growth is primarily driven by higher order volume (${ordersChange.text})`
  } else if (Math.abs(aovChange.pct) >= Math.abs(ordersChange.pct) && aovChange.pct !== 0) {
    mainDriver = aovChange.pct < 0
      ? `the decline coincides with lower average ticket spend (${aovChange.text})`
      : `revenue growth is driven by larger order tickets (${aovChange.text})`
  }

  const sampleCount = current.totalOrders + previous.totalOrders
  const confidence = sampleCount > 5 ? 'high' : sampleCount > 0 ? 'medium' : 'limited_data'

  const answer = isComparison
    ? current.netSales < previous.netSales
      ? `Sales are ${Math.abs(salesChange.pct)}% lower than the equivalent baseline (${context.comparisonPeriod?.label || 'previous period'}). Order count is ${ordersChange.text} while Average Order Value changed by ${aovChange.text}. The largest observed difference is in ${Math.abs(ordersChange.pct) > Math.abs(aovChange.pct) ? 'order count' : 'average ticket size'}.`
      : current.netSales > previous.netSales
      ? `Sales are ${salesChange.text} higher than ${context.comparisonPeriod?.label || 'previous period'} with ${current.totalOrders} total orders (compared to ${previous.totalOrders}). Average order value is ${formatPKR(current.averageOrderValue)}.`
      : `Sales for ${context.period.label} are currently identical or comparable to ${context.comparisonPeriod?.label || 'previous period'}.`
    : `Recorded Net Sales for ${context.period.label} are ${formatPKR(current.netSales)} across ${current.totalOrders} total orders (Average Order Value: ${formatPKR(current.averageOrderValue)}). Gross sales stand at ${formatPKR(current.grossSales)} with ${formatPKR(current.totalDiscounts)} in discounts.`

  return {
    intent: isComparison ? 'sales_comparison' : 'sales_overview',
    title: isComparison ? `Sales Comparison: ${context.period.label} vs ${context.comparisonPeriod?.label}` : `Sales Overview (${context.period.label})`,
    summary: isComparison
      ? `Net sales: ${formatPKR(current.netSales)} (${salesChange.text} vs baseline). ${mainDriver}.`
      : `Net sales: ${formatPKR(current.netSales)} across ${current.completedOrders} completed orders.`,
    answer,
    metrics: [
      {
        label: 'Net Sales',
        value: formatPKR(current.netSales),
        change: isComparison ? salesChange.text : undefined,
        tone: salesChange.pct >= 0 ? 'ok' : 'warn',
        helper: `Gross: ${formatPKR(current.grossSales)}`,
      },
      {
        label: 'Total Orders',
        value: current.totalOrders,
        change: isComparison ? ordersChange.text : undefined,
        tone: ordersChange.pct >= 0 ? 'ok' : 'neutral',
        helper: `${current.completedOrders} completed · ${current.cancelledOrders} cancelled`,
      },
      {
        label: 'Average Order Value (AOV)',
        value: formatPKR(current.averageOrderValue),
        change: isComparison ? aovChange.text : undefined,
        tone: aovChange.pct >= 0 ? 'ok' : 'warn',
        helper: 'Per non-cancelled bill',
      },
      {
        label: 'Discounts Granted',
        value: formatPKR(current.totalDiscounts),
        tone: current.totalDiscounts > 0 ? 'warn' : 'neutral',
        helper: `Tax collected: ${formatPKR(current.totalTax)}`,
      },
    ],
    evidence: [
      {
        title: 'Current Period Revenue',
        detail: `${current.totalOrders} orders generating ${formatPKR(current.netSales)} net sales.`,
        figure: formatPKR(current.netSales),
      },
      {
        title: 'Baseline Comparison',
        detail: previous.totalOrders > 0
          ? `${previous.totalOrders} orders generated ${formatPKR(previous.netSales)} in ${context.comparisonPeriod?.label || 'previous period'}.`
          : `No order records observed in comparison period (${context.comparisonPeriod?.label}).`,
        figure: formatPKR(previous.netSales),
        baseline: context.comparisonPeriod?.label,
      },
      {
        title: 'Order Channels Mix',
        detail: `Dine-in: ${current.dineInCount} | Delivery: ${current.deliveryCount} | Takeaway: ${current.takeawayCount}`,
      },
      {
        title: 'Settled Payment Methods',
        detail: `Cash: ${formatPKR(current.cashTotal)} | Card: ${formatPKR(current.cardTotal)} | Digital/Wallets: ${formatPKR(current.onlineTotal)}`,
      },
    ],
    reason: 'Calculated deterministically from completed orders (excluding cancellations): Net Sales = SUM(order.total); AOV = Net Sales / Non-cancelled Order Count; Percentage Delta = ((Current - Baseline) / Baseline) * 100.',
    recommendations: [
      {
        actionText: 'Review POS Billing & Service Operations',
        explanation: 'Inspect active counter bills, table turnover, and delivery order dispatch in the live POS terminal.',
        targetRoute: '/pos',
        routeLabel: 'Open POS & Billing',
        priority: 'high',
      },
      {
        actionText: 'Audit Item Mix & Discounts in Reports',
        explanation: 'Check whether high-ticket specialties had lower sales or if discounts/promotions impacted revenue.',
        targetRoute: '/reports',
        routeLabel: 'Open Sales Reports',
        priority: 'medium',
      },
    ],
    confidence,
    limitations: [
      'Comparisons use non-cancelled transactions within registered Karachi business dates.',
      'Unentered or pending offline cash transactions are excluded until synced.',
    ],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount,
      reliability: confidence === 'high' ? 'complete' : 'partial',
      notes: sampleCount === 0 ? 'No order transactions recorded for this date range.' : undefined,
    },
    generatedAt: new Date().toISOString(),
  }
}
