export type AppRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen'
export type OrderType = 'dine_in' | 'takeaway' | 'delivery'
export type OrderStatus = 'open' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'jazzcash' | 'easypaisa' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type CashMovementKind = 'expense' | 'pay_in' | 'pay_out'
export type StockReason = 'purchase' | 'sale' | 'waste' | 'adjustment' | 'opening' | 'return'
export type RiderStatus = 'unassigned' | 'assigned' | 'out_for_delivery' | 'delivered' | 'returned'

export interface Profile {
  id: string
  branch_id: string | null
  role: AppRole
  full_name: string
  pin_set_at?: string | null
  is_active: boolean
}

export interface Branch {
  id: string
  name: string
  city: string
  address?: string | null
  phone?: string | null
  tax_rate: number
  currency_symbol: string
  receipt_header: string
  receipt_footer: string
  auto_deduct_stock: boolean
  delivery_fee: number
  service_charge_rate: number
  is_active: boolean
}

export interface MenuCategory {
  id: string
  branch_id: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface MenuItem {
  id: string
  branch_id: string
  category_id: string
  name: string
  description?: string | null
  price: number
  is_available: boolean
  image_url?: string | null
}

export interface DiningTable {
  id: string
  branch_id: string
  label: string
  seats: number
  is_active: boolean
  location?: string | null
  current_order_id?: string | null
  current_order_status?: OrderStatus | null
}

export interface TableReservation {
  id: string
  branch_id: string
  table_id: string
  customer_name: string
  customer_phone: string
  guest_count: number
  reservation_time: string
  status: 'confirmed' | 'seated' | 'cancelled' | 'completed'
  notes?: string | null
  created_at: string
  table?: DiningTable
}

export interface OrderItem {
  id: string
  order_id: string
  branch_id: string
  menu_item_id: string
  item_name: string
  unit_price: number
  quantity: number
  line_total: number
  notes?: string | null
}

export interface Order {
  id: string
  branch_id: string
  order_number: number
  business_date: string
  client_request_id: string
  type: OrderType
  status: OrderStatus
  table_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  delivery_address?: string | null
  delivery_fee: number
  rider_name?: string | null
  rider_phone?: string | null
  rider_status?: RiderStatus
  rider_cash_collected: number
  rider_cash_handed_over: boolean
  subtotal: number
  discount: number
  tax: number
  total: number
  notes?: string | null
  created_by: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
  payments?: Payment[]
  table?: DiningTable
}

export interface Payment {
  id: string
  branch_id: string
  order_id: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  cash_session_id?: string | null
  provider_reference?: string | null
  idempotency_key: string
  received_by?: string | null
  created_at: string
  confirmed_at?: string | null
}

export interface CashSession {
  id: string
  branch_id: string
  opened_by: string
  opened_at: string
  opening_float: number
  closed_by?: string | null
  closed_at?: string | null
  expected_cash?: number | null
  counted_cash?: number | null
  variance?: number | null
  notes?: string | null
  opened_by_profile?: Profile
}

export interface CashMovement {
  id: string
  branch_id: string
  cash_session_id: string
  kind: CashMovementKind
  amount: number
  reason: string
  created_by: string
  created_at: string
}

export interface InventoryItem {
  id: string
  branch_id: string
  name: string
  unit: string
  current_qty: number
  reorder_level: number
  is_active: boolean
  created_at: string
}

export interface RecipeItem {
  id: string
  branch_id: string
  menu_item_id: string
  inventory_item_id: string
  quantity: number
  unit: string
  inventory_item?: InventoryItem
}

export interface StockMovement {
  id: string
  branch_id: string
  inventory_item_id: string
  delta: number
  reason: StockReason
  order_id?: string | null
  note?: string | null
  created_by?: string | null
  created_at: string
  inventory_item?: InventoryItem
}

export interface Supplier {
  id: string
  branch_id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  is_active: boolean
  created_at: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  inventory_item_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  inventory_item?: InventoryItem
}

export interface PurchaseOrder {
  id: string
  branch_id: string
  supplier_id: string
  po_number: string
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  total_amount: number
  invoice_no?: string | null
  notes?: string | null
  ordered_at?: string | null
  received_at?: string | null
  created_at: string
  supplier?: Supplier
  items?: PurchaseOrderItem[]
}

export interface Expense {
  id: string
  branch_id: string
  category: 'utilities' | 'salaries' | 'maintenance' | 'supplies' | 'rent' | 'marketing' | 'raw_materials' | 'other'
  amount: number
  payment_method: PaymentMethod
  cash_session_id?: string | null
  description: string
  vendor?: string | null
  receipt_url?: string | null
  created_by: string
  created_at: string
}

export interface Customer {
  id: string
  branch_id: string
  name: string
  phone: string
  email?: string | null
  address?: string | null
  notes?: string | null
  total_orders: number
  total_spent: number
  created_at: string
}

export interface DashboardMetrics {
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  gross_sales: number
  total_discounts: number
  total_tax: number
  net_sales: number
  average_order_value: number
  total_expenses: number
  low_stock_count: number
  payments_by_method: Record<string, number>
  orders_by_type: Record<string, number>
  top_items: Array<{ item_name: string; qty_sold: number; revenue: number }>
  active_session: { id: string; opened_at: string; opening_float: number; opened_by_name: string } | null
  open_tables: number
  occupied_tables: number
}
