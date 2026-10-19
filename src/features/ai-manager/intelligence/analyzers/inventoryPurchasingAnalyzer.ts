import { formatPKR } from '@/lib/format'
import { computeInventoryRestock } from '../metrics'
import type { OperationalContext, AiAnalysisResult } from '../types'

export function analyzeInventoryAndPurchasing(
  context: OperationalContext,
  isPurchasingIntent: boolean
): AiAnalysisResult {
  const restockItems = computeInventoryRestock(context.inventory)
  const lowStockItems = restockItems.filter((i) => i.status === 'critical' || i.status === 'low')
  const criticalItems = restockItems.filter((i) => i.status === 'critical')

  const totalEstimatedCost = lowStockItems.reduce((acc, i) => acc + i.estimatedTotalCost, 0)
  const totalSuggestedUnits = lowStockItems.reduce((acc, i) => acc + i.suggestedOrderQty, 0)

  let answer: string
  if (lowStockItems.length === 0) {
    answer = `All ${context.inventory.length} active inventory items are currently above their configured reorder safety thresholds. No emergency supplier purchases are required for the next service.`
  } else if (isPurchasingIntent) {
    answer = `${lowStockItems.length} ingredient${lowStockItems.length > 1 ? 's are' : ' is'} below safety threshold and recommended for reorder. Total estimated procurement outlay is ${formatPKR(totalEstimatedCost)} across ${totalSuggestedUnits} units. Key depleted items include ${lowStockItems.map((i) => `${i.name} (${i.currentQty} ${i.unit} on hand vs ${i.reorderLevel} min)`).join(', ')}.`
  } else {
    answer = `${lowStockItems.length} ingredient${lowStockItems.length > 1 ? 's have' : ' has'} dropped below configured reorder levels (${criticalItems.length} at critical emergency level <= 50% safety stock): ${lowStockItems.map((i) => `${i.name} (Current: ${i.currentQty} ${i.unit}, Reorder: ${i.reorderLevel} ${i.unit})`).join('; ')}.`
  }

  const confidence = context.inventory.length > 0 ? 'high' : 'limited_data'

  return {
    intent: isPurchasingIntent ? 'purchase_recommendations' : 'low_stock_alerts',
    title: isPurchasingIntent
      ? 'Purchase & Procurement Recommendations'
      : 'Inventory Safety Stock & Reorder Alerts',
    summary: lowStockItems.length > 0
      ? `${lowStockItems.length} items require reorder (${formatPKR(totalEstimatedCost)} estimated outlay).`
      : 'All inventory items are currently at healthy stock levels.',
    answer,
    metrics: [
      {
        label: 'Low Stock Items',
        value: lowStockItems.length,
        tone: lowStockItems.length > 0 ? 'warn' : 'ok',
        helper: `${criticalItems.length} critical emergency (< 50%)`,
      },
      {
        label: 'Estimated Restock Outlay',
        value: formatPKR(totalEstimatedCost),
        tone: totalEstimatedCost > 0 ? 'accent' : 'neutral',
        helper: 'Based on benchmark unit costs',
      },
      {
        label: 'Healthy Stock Items',
        value: restockItems.filter((i) => i.status === 'healthy').length,
        tone: 'ok',
        helper: `Out of ${context.inventory.length} total ingredients`,
      },
      {
        label: 'Active Purchase Orders',
        value: (context.purchaseOrders || []).filter((p) => p.status === 'draft' || p.status === 'ordered').length,
        tone: 'neutral',
        helper: `${(context.purchaseOrders || []).filter((p) => p.status === 'received').length} received to date`,
      },
    ],
    evidence: lowStockItems.length > 0
      ? lowStockItems.map((item) => ({
          title: `${item.name} [${item.status.toUpperCase()}]`,
          detail: `On Hand: ${item.currentQty} ${item.unit} | Safety Level: ${item.reorderLevel} ${item.unit} | Deficit: -${item.deficit} ${item.unit} | Suggested Order: +${item.suggestedOrderQty} ${item.unit} | Est. Cost: ${formatPKR(item.estimatedTotalCost)}`,
          figure: `${item.currentQty} / ${item.reorderLevel} ${item.unit}`,
        }))
      : context.inventory.slice(0, 4).map((item) => ({
          title: `${item.name} [HEALTHY]`,
          detail: `On Hand: ${item.current_qty} ${item.unit} (Reorder threshold: ${item.reorder_level} ${item.unit})`,
          figure: `${item.current_qty} ${item.unit}`,
        })),
    reason: 'Inventory items are evaluated using: Low Stock Condition = current_qty <= reorder_level. Suggested Order Quantity = MAX(reorder_level * 2 - current_qty, reorder_level). Estimated procurement outlay is computed from benchmark supplier unit rates.',
    recommendations: [
      {
        actionText: 'Draft Purchase Orders for Depleted Items',
        explanation: 'Review supplier catalogues, draft purchase orders, and record received vendor stock.',
        targetRoute: '/purchasing',
        routeLabel: 'Open Purchasing Console',
        priority: 'high',
      },
      {
        actionText: 'Review Stock Levels & Manual Adjustments',
        explanation: 'Inspect current stock quantities, wastage logs, and physical counts under Inventory.',
        targetRoute: '/inventory',
        routeLabel: 'Open Inventory & Stock',
        priority: 'medium',
      },
    ],
    confidence,
    limitations: [
      'Safety stock calculations rely on current stock balances in the database ledger.',
      'Purchase recommendations are advisory; orders are never auto-submitted without staff confirmation.',
    ],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount: context.inventory.length,
      reliability: 'complete',
      notes: `${context.inventory.length} inventory items audited.`,
    },
    generatedAt: new Date().toISOString(),
  }
}
