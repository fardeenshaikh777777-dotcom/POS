import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import { getKarachiBusinessDate } from '@/lib/format'
import { getDefaultPeriod } from './intelligence/normalizer'
import type { OperationalContext } from './intelligence/types'
import type { AppRole, Order, InventoryItem, MenuItem, MenuCategory, Expense, DiningTable, TableReservation, Customer, PurchaseOrder, RecipeItem, CashSession } from '@/types/domain'

// Simple in-memory cache to prevent redundant fetches during back-to-back questions
let cachedContext: { key: string; timestamp: number; context: OperationalContext } | null = null
const CACHE_TTL_MS = 15000 // 15 seconds

export async function fetchOperationalContext(
  branchId: string,
  userRole: AppRole,
  selectedPeriodKey: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' = 'today'
): Promise<OperationalContext> {
  const cacheKey = `${branchId}_${userRole}_${selectedPeriodKey}`
  const now = Date.now()

  if (cachedContext && cachedContext.key === cacheKey && now - cachedContext.timestamp < CACHE_TTL_MS) {
    return cachedContext.context
  }

  const { period, comparisonPeriod } = getDefaultPeriod(selectedPeriodKey)

  let orders: Order[] = []
  let comparisonOrders: Order[] = []
  let inventory: InventoryItem[] = []
  let menuItems: MenuItem[] = []
  let categories: MenuCategory[] = []
  let recipes: RecipeItem[] = []
  let expenses: Expense[] = []
  let comparisonExpenses: Expense[] = []
  let tables: DiningTable[] = []
  let reservations: TableReservation[] = []
  let customers: Customer[] = []
  let purchaseOrders: PurchaseOrder[] = []
  let activeCashSession: CashSession | null = null

  if (isSupabaseConfigured) {
    try {
      // 1. Current period orders
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, branch_id, order_number, business_date, type, status, subtotal, discount, tax, total, created_at, items:order_items(id, menu_item_id, item_name, unit_price, quantity, line_total), payments(id, method, amount, status)')
        .eq('branch_id', branchId)
        .gte('business_date', period.start)
        .lte('business_date', period.end)

      if (dbOrders) orders = dbOrders as Order[]

      // 2. Comparison period orders
      const { data: dbCompOrders } = await supabase
        .from('orders')
        .select('id, branch_id, order_number, business_date, type, status, subtotal, discount, tax, total, created_at, items:order_items(id, menu_item_id, item_name, unit_price, quantity, line_total), payments(id, method, amount, status)')
        .eq('branch_id', branchId)
        .gte('business_date', comparisonPeriod.start)
        .lte('business_date', comparisonPeriod.end)

      if (dbCompOrders) comparisonOrders = dbCompOrders as Order[]

      // 3. Inventory
      const { data: dbInv } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)

      if (dbInv) inventory = dbInv as InventoryItem[]

      // 4. Menu & recipes
      const { data: dbMenu } = await supabase
        .from('menu_items')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_available', true)

      if (dbMenu) menuItems = dbMenu as MenuItem[]

      const { data: dbRecipes } = await supabase
        .from('recipe_items')
        .select('*')
        .eq('branch_id', branchId)

      if (dbRecipes) recipes = dbRecipes as RecipeItem[]

      // 5. Expenses
      const { data: dbExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('branch_id', branchId)
        .gte('created_at', `${period.start}T00:00:00`)
        .lte('created_at', `${period.end}T23:59:59`)

      if (dbExp) expenses = dbExp as Expense[]

      const { data: dbCompExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('branch_id', branchId)
        .gte('created_at', `${comparisonPeriod.start}T00:00:00`)
        .lte('created_at', `${comparisonPeriod.end}T23:59:59`)

      if (dbCompExp) comparisonExpenses = dbCompExp as Expense[]

      // 6. Tables & reservations
      const { data: dbTables } = await supabase
        .from('dining_tables')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)

      if (dbTables) tables = dbTables as DiningTable[]

      const { data: dbRes } = await supabase
        .from('table_reservations')
        .select('*')
        .eq('branch_id', branchId)
        .gte('reservation_time', `${period.start}T00:00:00`)

      if (dbRes) reservations = dbRes as TableReservation[]

      // 7. Customers
      const { data: dbCust } = await supabase
        .from('customers')
        .select('*')
        .eq('branch_id', branchId)
        .order('total_spent', { ascending: false })
        .limit(50)

      if (dbCust) customers = dbCust as Customer[]

      // 8. Purchase Orders
      const { data: dbPo } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (dbPo) purchaseOrders = dbPo as PurchaseOrder[]

      // 9. Active cash session
      const { data: dbSession } = await supabase
        .from('cash_sessions')
        .select('*, opened_by_profile:profiles!cash_sessions_opened_by_fkey(*)')
        .eq('branch_id', branchId)
        .is('closed_at', null)
        .maybeSingle()

      if (dbSession) activeCashSession = dbSession
    } catch {
      // Fallback to storage
    }
  }

  // Fallback / supplement with Storage
  if (orders.length === 0) {
    const allOrders = Storage.getOrders(branchId)
    orders = allOrders.filter((o) => {
      const d = o.business_date || (o.created_at ? getKarachiBusinessDate(new Date(o.created_at)) : period.start)
      return d >= period.start && d <= period.end
    })

    comparisonOrders = allOrders.filter((o) => {
      const d = o.business_date || (o.created_at ? getKarachiBusinessDate(new Date(o.created_at)) : comparisonPeriod.start)
      return d >= comparisonPeriod.start && d <= comparisonPeriod.end
    })
  }

  if (inventory.length === 0) inventory = Storage.getInventory(branchId)
  if (menuItems.length === 0) menuItems = Storage.getMenuItems(branchId)
  if (categories.length === 0) categories = Storage.getCategories(branchId)
  if (recipes.length === 0) recipes = Storage.getRecipes(branchId)

  if (expenses.length === 0) {
    const allExp = Storage.getExpenses(branchId)
    expenses = allExp.filter((e) => {
      const d = e.created_at ? getKarachiBusinessDate(new Date(e.created_at)) : period.start
      return d >= period.start && d <= period.end
    })
    comparisonExpenses = allExp.filter((e) => {
      const d = e.created_at ? getKarachiBusinessDate(new Date(e.created_at)) : comparisonPeriod.start
      return d >= comparisonPeriod.start && d <= comparisonPeriod.end
    })
  }

  if (tables.length === 0) tables = Storage.getTables(branchId)
  if (reservations.length === 0) reservations = Storage.getReservations(branchId)
  if (customers.length === 0) customers = Storage.getCustomers(branchId)

  if (!activeCashSession) {
    try {
      const raw = localStorage.getItem(`karachi_pos_active_session_${branchId}`)
      if (raw) activeCashSession = JSON.parse(raw)
    } catch {
      // ignore
    }
  }

  const context: OperationalContext = {
    branchId,
    branchName: 'Clifton Flagship Branch',
    userRole,
    period,
    comparisonPeriod,
    orders,
    comparisonOrders,
    inventory,
    menuItems,
    categories,
    recipes,
    expenses,
    comparisonExpenses,
    tables,
    reservations,
    customers,
    purchaseOrders,
    activeCashSession,
  }

  cachedContext = { key: cacheKey, timestamp: now, context }
  return context
}

export function clearOperationalContextCache(): void {
  cachedContext = null
}
