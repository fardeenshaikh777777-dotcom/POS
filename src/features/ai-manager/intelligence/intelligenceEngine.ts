import { normalizeQuery } from './normalizer'
import { matchIntent, SUGGESTED_QUESTIONS } from './intentRegistry'
import { analyzeSales } from './analyzers/salesAnalyzer'
import { analyzeMenuProfitability } from './analyzers/menuProfitabilityAnalyzer'
import { analyzeInventoryAndPurchasing } from './analyzers/inventoryPurchasingAnalyzer'
import { analyzeCashDiscrepancy, analyzeExpenses } from './analyzers/expenseCashAnalyzer'
import {
  analyzeBestSellingDishes,
  analyzeKitchenOperations,
  analyzeTableOccupancy,
  analyzeCustomerLoyalty,
} from './analyzers/operationsCustomerAnalyzer'
import type { OperationalContext, AiAnalysisResult } from './types'
import type { AppRole } from '@/types/domain'

/**
 * Validates role-level access to financial vs operational insights
 */
export function isIntentPermittedForRole(intent: string, role: AppRole): boolean {
  if (role === 'owner' || role === 'manager') return true

  // Cashier can access cash drawer, POS orders, and customer queries
  if (role === 'cashier') {
    return ['cash_discrepancy', 'sales_overview', 'best_selling_dishes', 'customer_loyalty', 'table_occupancy'].includes(intent)
  }

  // Kitchen can access low stock, recipes, and kitchen operations
  if (role === 'kitchen') {
    return ['low_stock_alerts', 'purchase_recommendations', 'operations_kitchen'].includes(intent)
  }

  // Waiter can access table occupancy and kitchen operations
  if (role === 'waiter') {
    return ['table_occupancy', 'operations_kitchen'].includes(intent)
  }

  return false
}

/**
 * Main Deterministic Intelligence Engine
 */
export function executeIntelligenceQuery(
  rawQuery: string,
  baseContext: OperationalContext
): AiAnalysisResult {
  const norm = normalizeQuery(rawQuery)

  // Determine effective period: query-detected period takes precedence, else UI context period
  let effectiveContext = baseContext
  if (norm.detectedPeriod) {
    effectiveContext = {
      ...baseContext,
      period: norm.detectedPeriod,
      comparisonPeriod: norm.comparisonPeriod || baseContext.comparisonPeriod,
    }
  }

  const { intent, confidence } = matchIntent(norm)

  // Enforce role authorization
  if (intent !== 'unsupported' && !isIntentPermittedForRole(intent, baseContext.userRole)) {
    return {
      intent: 'unsupported',
      title: 'Restricted Operational Metric',
      summary: `Role "${baseContext.userRole.toUpperCase()}" is not authorized for executive financial analytics.`,
      answer: `Access to financial profitability, owner cash reconciliations, or overhead reports is restricted to Management & Owners. Your station role (${baseContext.userRole.toUpperCase()}) has access to live counter, kitchen, and inventory operational queries.`,
      metrics: [
        { label: 'Station Role', value: baseContext.userRole.toUpperCase(), tone: 'warn' },
        { label: 'Access Policy', value: 'Role-Gated (RLS)', tone: 'neutral' },
      ],
      evidence: [
        {
          title: 'Permission Check',
          detail: `User role "${baseContext.userRole}" cannot access intent "${intent}".`,
        },
      ],
      reason: 'Role-based access control enforces least-privilege security at both the UI and database Row-Level Security layers.',
      recommendations: [
        {
          actionText: 'Return to Authorized Station',
          explanation: 'Navigate back to your primary station workflow.',
          targetRoute: baseContext.userRole === 'kitchen' ? '/kitchen' : baseContext.userRole === 'waiter' ? '/pos' : '/cash',
          routeLabel: 'Open Assigned Module',
        },
      ],
      confidence: 'high',
      limitations: ['RLS and role policies strictly prevent unauthorized data extraction.'],
      sourcePeriod: effectiveContext.period,
      dataQuality: { sampleCount: 0, reliability: 'complete' },
      generatedAt: new Date().toISOString(),
      supportedSuggestions: SUGGESTED_QUESTIONS.filter((q) => !q.requiredRole || q.requiredRole.includes(baseContext.userRole)).map((q) => q.text),
    }
  }

  switch (intent) {
    case 'sales_comparison':
      return analyzeSales(effectiveContext, true)

    case 'sales_overview':
      return analyzeSales(effectiveContext, false)

    case 'menu_profitability':
      return analyzeMenuProfitability(effectiveContext)

    case 'best_selling_dishes':
      return analyzeBestSellingDishes(effectiveContext)

    case 'low_stock_alerts':
      return analyzeInventoryAndPurchasing(effectiveContext, false)

    case 'purchase_recommendations':
      return analyzeInventoryAndPurchasing(effectiveContext, true)

    case 'cash_discrepancy':
      return analyzeCashDiscrepancy(effectiveContext)

    case 'expense_analysis':
      return analyzeExpenses(effectiveContext)

    case 'operations_kitchen':
      return analyzeKitchenOperations(effectiveContext)

    case 'table_occupancy':
      return analyzeTableOccupancy(effectiveContext)

    case 'customer_loyalty':
      return analyzeCustomerLoyalty(effectiveContext)

    case 'unsupported':
    default:
      return {
        intent: 'unsupported',
        title: 'Query Assistance & Available Analyses',
        summary: 'Question could not be matched with high confidence to a verified business rule.',
        answer: `I could not find a deterministic rule matching your question: "${rawQuery}". The AI Restaurant Manager uses verified operational algorithms (no external generative models). You can ask about sales comparisons, menu margins, low stock alerts, cash balancing, or kitchen speed.`,
        metrics: [
          { label: 'Match Confidence', value: `${Math.round(confidence * 100)}%`, tone: 'warn' },
          { label: 'Available Domains', value: '10 Core Engines', tone: 'accent' },
        ],
        evidence: [
          {
            title: 'Extracted Terms',
            detail: norm.tokens.length > 0 ? norm.tokens.join(', ') : 'None',
          },
          {
            title: 'Available Operational Topics',
            detail: 'Sales Trends · Menu Contribution Margin · Low Stock & Restock · Cash Drawer Balancing · Kitchen KDS Operations · Expenses & Overhead · Table Occupancy · Customer Orders',
          },
        ],
        reason: 'Rule-based intelligence requires matching registered business intents to ensure transparent, reproducible, and mathematically sound operational guidance.',
        recommendations: [
          {
            actionText: 'Try a Suggested Operational Question',
            explanation: 'Click on one of the suggested inquiries below to run an instant validated calculation.',
            priority: 'high',
          },
        ],
        confidence: 'limited_data',
        limitations: [
          'Arbitrary generative text synthesis is disabled by design.',
          'All answers must be backed by verifiable database records and formulas.',
        ],
        sourcePeriod: effectiveContext.period,
        dataQuality: { sampleCount: 0, reliability: 'limited' },
        generatedAt: new Date().toISOString(),
        supportedSuggestions: [
          "Why are today's sales lower than yesterday's?",
          'Which dishes sold the most today?',
          'Which menu items have the highest estimated contribution margin?',
          'Which ingredients are below their reorder thresholds?',
          'Is the cash drawer closing balance different from the expected balance?',
        ],
      }
  }
}
