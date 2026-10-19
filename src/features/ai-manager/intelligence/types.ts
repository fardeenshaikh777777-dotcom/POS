import type { AppRole } from '@/types/domain'

export type AiIntent =
  | 'sales_overview'
  | 'sales_comparison'
  | 'best_selling_dishes'
  | 'menu_profitability'
  | 'low_stock_alerts'
  | 'purchase_recommendations'
  | 'cash_discrepancy'
  | 'expense_analysis'
  | 'operations_kitchen'
  | 'customer_loyalty'
  | 'table_occupancy'
  | 'unsupported'

export interface AnalysisPeriod {
  start: string
  end: string
  label: string
  days: number
}

export interface MetricCardData {
  label: string
  value: string | number
  change?: string
  tone?: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent'
  helper?: string
}

export interface EvidenceItem {
  title: string
  detail: string
  figure?: string
  baseline?: string
}

export interface RecommendationItem {
  actionText: string
  explanation: string
  targetRoute?: string
  routeLabel?: string
  priority?: 'high' | 'medium' | 'low'
}

export interface DataQualityReport {
  sampleCount: number
  reliability: 'complete' | 'partial' | 'limited'
  missingFields?: string[]
  notes?: string
}

export interface AiAnalysisResult {
  intent: AiIntent
  title: string
  summary: string
  answer: string
  metrics: MetricCardData[]
  evidence: EvidenceItem[]
  reason: string
  recommendations: RecommendationItem[]
  confidence: 'high' | 'medium' | 'limited_data'
  limitations: string[]
  sourcePeriod: AnalysisPeriod
  dataQuality: DataQualityReport
  generatedAt: string
  supportedSuggestions?: string[]
}

export interface SuggestedQuestion {
  id: string
  text: string
  category: 'sales' | 'menu' | 'inventory' | 'cash' | 'operations'
  requiredRole?: AppRole[]
  description?: string
}

import type {
  Order,
  InventoryItem,
  MenuItem,
  MenuCategory,
  RecipeItem,
  Expense,
  DiningTable,
  TableReservation,
  Customer,
  PurchaseOrder,
  CashSession,
} from '@/types/domain'

export interface OperationalContext {
  branchId: string
  branchName: string
  userRole: AppRole
  period: AnalysisPeriod
  comparisonPeriod?: AnalysisPeriod
  orders: Order[]
  comparisonOrders?: Order[]
  inventory: InventoryItem[]
  menuItems: MenuItem[]
  categories: MenuCategory[]
  recipes: RecipeItem[]
  expenses: Expense[]
  comparisonExpenses?: Expense[]
  tables: DiningTable[]
  reservations: TableReservation[]
  customers: Customer[]
  purchaseOrders: PurchaseOrder[]
  activeCashSession?: CashSession | null
  recentCashSessions?: CashSession[]
}
