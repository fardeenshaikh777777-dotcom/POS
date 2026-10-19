import type { AiIntent, SuggestedQuestion } from './types'
import type { NormalizedQuery } from './normalizer'

export interface IntentRule {
  intent: AiIntent
  title: string
  keywords: string[]
  phrases: string[]
  weight: number
}

export const INTENT_RULES: IntentRule[] = [
  {
    intent: 'sales_comparison',
    title: 'Sales Period Comparison',
    keywords: ['compare', 'comparison', 'versus', 'vs', 'difference', 'why', 'lower', 'higher', 'dropped', 'increased', 'decline', 'growth'],
    phrases: [
      'compare sales',
      'why are sales lower',
      'why did sales decrease',
      'sales compared to yesterday',
      'sales compared to last week',
      'how is this week performing',
      'sales drop',
      'sales increase',
      'performance vs yesterday',
    ],
    weight: 2.5,
  },
  {
    intent: 'menu_profitability',
    title: 'Menu Profitability & Contribution Margin',
    keywords: ['profit', 'profitable', 'margin', 'margins', 'food cost', 'cost', 'contribution', 'gross profit', 'cogs', 'least profitable', 'profitability'],
    phrases: [
      'menu profitability',
      'highest margin',
      'contribution margin',
      'highest food cost',
      'which dishes are less profitable',
      'dish profit',
      'food cost percentage',
      'which dishes make money',
    ],
    weight: 2.2,
  },
  {
    intent: 'purchase_recommendations',
    title: 'Purchase & Restock Recommendations',
    keywords: ['purchase', 'buy', 'order stock', 'supplier', 'reorder', 'po', 'procure', 'procurement', 'restock', 'shopping list', 'vendor'],
    phrases: [
      'items to reorder',
      'what to buy',
      'purchase recommendations',
      'purchase order',
      'what purchases may be needed',
      'stock to order',
      'supplier order',
      'ingredients to buy',
    ],
    weight: 2.0,
  },
  {
    intent: 'low_stock_alerts',
    title: 'Low Stock & Inventory Alerts',
    keywords: ['low stock', 'stock', 'inventory', 'reorder level', 'shortage', 'running out', 'expiring', 'depleted', 'ingredient', 'ingredients'],
    phrases: [
      'low stock',
      'ingredients below reorder',
      'stock alerts',
      'which ingredients are low',
      'items below minimum',
      'inventory status',
      'what is running out',
      'critical stock',
    ],
    weight: 1.8,
  },
  {
    intent: 'best_selling_dishes',
    title: 'Best Selling & Popular Dishes',
    keywords: ['best selling', 'top selling', 'most sold', 'popular', 'dishes', 'items', 'favorites', 'menu performance', 'top items', 'biryani sold'],
    phrases: [
      'best selling items',
      'which dishes sold the most',
      'top selling dishes',
      'most popular items',
      'what sold today',
      'top dishes',
      'dish volume',
    ],
    weight: 1.7,
  },
  {
    intent: 'cash_discrepancy',
    title: 'Cash Drawer Balancing & Variance',
    keywords: ['cash', 'drawer', 'till', 'closing balance', 'counted', 'expected cash', 'variance', 'shortage', 'overage', 'discrepancy', 'galla', 'session'],
    phrases: [
      'cash difference',
      'cash drawer variance',
      'drawer closing balance',
      'cash mismatch',
      'expected vs actual cash',
      'cash session balance',
      'shortage in drawer',
      'cash reconciliation',
    ],
    weight: 1.9,
  },
  {
    intent: 'expense_analysis',
    title: 'Expenses & Overhead Analysis',
    keywords: ['expense', 'expenses', 'spending', 'cost', 'costs', 'utilities', 'bills', 'payout', 'payouts', 'supplies', 'petty cash', 'kharcha'],
    phrases: [
      'expense report',
      'expense categories',
      'which expenses increased',
      'highest expenses',
      'operational costs',
      'expense this month',
      'unusual expenses',
      'petty cash spending',
    ],
    weight: 1.8,
  },
  {
    intent: 'operations_kitchen',
    title: 'Kitchen & Service Operations',
    keywords: ['kitchen', 'kds', 'prep', 'preparation time', 'slow', 'delay', 'delays', 'speed', 'rush', 'peak hour', 'busy time', 'orders waiting'],
    phrases: [
      'slow orders',
      'order preparation times',
      'kitchen delay',
      'busy service periods',
      'peak hours',
      'orders taking longer',
      'kitchen speed',
    ],
    weight: 1.6,
  },
  {
    intent: 'table_occupancy',
    title: 'Table Occupancy & Floor Plan',
    keywords: ['table', 'tables', 'occupancy', 'seated', 'dining', 'booking', 'reservation', 'reservations', 'floor', 'hall'],
    phrases: [
      'table occupancy',
      'open tables',
      'occupied tables',
      'reservations today',
      'table bookings',
      'dining capacity',
    ],
    weight: 1.5,
  },
  {
    intent: 'customer_loyalty',
    title: 'Customer Directory & Repeat Orders',
    keywords: ['customer', 'customers', 'client', 'repeat', 'frequent', 'loyalty', 'vip', 'spenders', 'inactive'],
    phrases: [
      'repeat customers',
      'top customers',
      'customer activity',
      'who ordered the most',
      'frequent buyers',
      'customer spenders',
    ],
    weight: 1.4,
  },
  {
    intent: 'sales_overview',
    title: 'Sales & Revenue Overview',
    keywords: ['sales', 'revenue', 'income', 'orders', 'total', 'bills', 'aov', 'average order', 'gross', 'net sales', 'turnover', 'earnings', 'kamai'],
    phrases: [
      'sales today',
      'how much did we sell',
      'total sales',
      'today revenue',
      'orders today',
      'average ticket',
      'sales this week',
      'sales report',
    ],
    weight: 1.0,
  },
]

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    id: 'sq-1',
    text: "Why are today's sales lower than yesterday's?",
    category: 'sales',
    description: 'Compares revenue, order counts, and ticket averages against yesterday',
  },
  {
    id: 'sq-2',
    text: 'Which dishes sold the most today?',
    category: 'menu',
    description: 'Itemized sales volumes and revenue contributions',
  },
  {
    id: 'sq-3',
    text: 'Which menu items have the highest estimated contribution margin?',
    category: 'menu',
    description: 'Ingredient cost vs price analysis for dish profitability',
  },
  {
    id: 'sq-4',
    text: 'Which ingredients are below their reorder thresholds?',
    category: 'inventory',
    description: 'Safety stock alerts and low inventory levels',
  },
  {
    id: 'sq-5',
    text: 'What purchases may be needed for the next service?',
    category: 'inventory',
    description: 'Purchase recommendations based on depleted stock and recent demand',
  },
  {
    id: 'sq-6',
    text: 'Is the cash drawer closing balance different from the expected balance?',
    category: 'cash',
    description: 'Cash reconciliation, opening float, cash sales, and payouts',
  },
  {
    id: 'sq-7',
    text: 'Which expense categories increased this month?',
    category: 'cash',
    description: 'Overhead breakdowns and unusual expense vouchers',
  },
  {
    id: 'sq-8',
    text: 'Which orders are taking longer than the configured preparation target?',
    category: 'operations',
    description: 'Kitchen fulfillment velocity and peak rush hours',
  },
  {
    id: 'sq-9',
    text: 'How is this week performing compared with last week?',
    category: 'sales',
    description: '7-day rolling revenue and order trend comparison',
  },
  {
    id: 'sq-10',
    text: 'Who are our most frequent repeat customers?',
    category: 'operations',
    description: 'Order counts and cumulative spend by customer',
  },
]

/**
 * Matches a query against registered intent rules with deterministic scoring
 */
export function matchIntent(query: NormalizedQuery): {
  intent: AiIntent
  confidence: number
  matchedRule?: IntentRule
} {
  const norm = query.normalized
  if (!norm || norm.length < 2) {
    return { intent: 'unsupported', confidence: 0 }
  }

  let bestIntent: AiIntent = 'unsupported'
  let bestScore = 0
  let matchedRule: IntentRule | undefined

  for (const rule of INTENT_RULES) {
    let score = 0

    // Exact phrase match (high weight)
    for (const phrase of rule.phrases) {
      if (norm.includes(phrase)) {
        score += 8.0 * rule.weight
      }
    }

    // Token keyword match
    for (const kw of rule.keywords) {
      if (kw.includes(' ')) {
        if (norm.includes(kw)) score += 4.0 * rule.weight
      } else {
        if (query.tokens.includes(kw)) {
          score += 2.0 * rule.weight
        } else if (norm.includes(kw)) {
          score += 1.0 * rule.weight
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIntent = rule.intent
      matchedRule = rule
    }
  }

  // Threshold check: need at least a solid score to match
  if (bestScore < 2.0) {
    return { intent: 'unsupported', confidence: 0 }
  }

  const confidence = Math.min(1.0, bestScore / 15.0)
  return { intent: bestIntent, confidence, matchedRule }
}
