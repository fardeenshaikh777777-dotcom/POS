import type {
  MenuCategory,
  MenuItem,
  InventoryItem,
  StockMovement,
  Customer,
  Expense,
  DiningTable,
  TableReservation,
  Profile,
  Order,
  OrderStatus,
  StockReason,
  PaymentMethod,
  AppRole,
  RecipeItem,
  Deal,
  MarketingConsent,
} from '@/types/domain'
import { getKarachiBusinessDate } from '@/lib/format'
import { normalizePhoneNumber } from '@/lib/phoneNormalizer'

const DEFAULT_BRANCH_ID = '635c7b14-54be-4b93-a75a-e2ddc0323827'

// Initial Seeds with rich imagery and realistic restaurant data
export const INITIAL_CATEGORIES: MenuCategory[] = [
  { id: 'cat-1', branch_id: DEFAULT_BRANCH_ID, name: 'Biryani & Rice', sort_order: 1, is_active: true },
  { id: 'cat-2', branch_id: DEFAULT_BRANCH_ID, name: 'Karahi & Handi', sort_order: 2, is_active: true },
  { id: 'cat-3', branch_id: DEFAULT_BRANCH_ID, name: 'Charcoal BBQ', sort_order: 3, is_active: true },
  { id: 'cat-4', branch_id: DEFAULT_BRANCH_ID, name: 'Seafood Specials', sort_order: 4, is_active: true },
  { id: 'cat-5', branch_id: DEFAULT_BRANCH_ID, name: 'Tandoor & Breads', sort_order: 5, is_active: true },
  { id: 'cat-6', branch_id: DEFAULT_BRANCH_ID, name: 'Beverages & Desserts', sort_order: 6, is_active: true },
]

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-1',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-1',
    name: 'Special Mutton Dum Biryani',
    description: 'Fragrant aged basmati rice cooked with tender mutton cuts, saffron, and traditional spices.',
    price: 850,
    is_available: true,
    image_url: '/dishes/mutton_biryani.jpg',
  },
  {
    id: 'item-2',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-1',
    name: 'Chicken Biryani (Double Masala)',
    description: 'Succulent chicken with spiced saffron rice and tender potato.',
    price: 480,
    is_available: true,
    image_url: '/dishes/chicken_biryani.jpg',
  },
  {
    id: 'item-3',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-2',
    name: 'Mutton Shinwari Karahi (Full)',
    description: 'Tender mutton cooked in pure animal fat with fresh tomatoes and black pepper.',
    price: 2600,
    is_available: true,
    image_url: '/dishes/mutton_karahi.jpg',
  },
  {
    id: 'item-4',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-3',
    name: 'Beef Seekh Kabab (4 Pcs)',
    description: 'Melt-in-mouth beef skewers char-grilled with crushed cumin and fresh mint.',
    price: 450,
    is_available: true,
    image_url: '/dishes/beef_kabab.jpg',
  },
  {
    id: 'item-5',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-4',
    name: 'Fish & Chips (British classic)',
    description: 'Crispy battered golden fish fillet served with tartar dip, crunchy fries and lemon wedge.',
    price: 1200,
    is_available: true,
    image_url: '/dishes/fish_chips.jpg',
  },
  {
    id: 'item-6',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-3',
    name: 'Chicken Tikka (Chest Piece)',
    description: 'Smoked on burning coals with authentic spicy red marinade.',
    price: 380,
    is_available: true,
    image_url: '/dishes/chicken_tikka.jpg',
  },
  {
    id: 'item-7',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-5',
    name: 'Garlic Roghani Naan',
    description: 'Fluffy clay oven bread with pure butter and roasted sesame seeds.',
    price: 90,
    is_available: true,
    image_url: '/dishes/garlic_naan.jpg',
  },
  {
    id: 'item-8',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-6',
    name: 'Fresh Mint Lemonade',
    description: 'Crushed ice with mint leaves, fresh lemon, and black rock salt.',
    price: 180,
    is_available: true,
    image_url: '/dishes/mint_lemonade.jpg',
  },
  {
    id: 'item-9',
    branch_id: DEFAULT_BRANCH_ID,
    category_id: 'cat-6',
    name: 'Karak Doodh Patti Chai',
    description: 'Slow-brewed strong tea with whole milk and fragrant green cardamom.',
    price: 120,
    is_available: true,
    image_url: '/dishes/karak_chai.jpg',
  },
]

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv-1', branch_id: DEFAULT_BRANCH_ID, name: 'Super Kernel Basmati Rice', unit: 'kg', current_qty: 120, reorder_level: 25, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-2', branch_id: DEFAULT_BRANCH_ID, name: 'Fresh Farm Broiler Chicken', unit: 'kg', current_qty: 12, reorder_level: 15, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-3', branch_id: DEFAULT_BRANCH_ID, name: 'Prime Boneless Beef', unit: 'kg', current_qty: 40, reorder_level: 10, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-4', branch_id: DEFAULT_BRANCH_ID, name: 'Fresh Mutton Meat', unit: 'kg', current_qty: 8, reorder_level: 10, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-5', branch_id: DEFAULT_BRANCH_ID, name: 'Cooking Oil (Canola/Soybean)', unit: 'Ltr', current_qty: 75, reorder_level: 20, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-6', branch_id: DEFAULT_BRANCH_ID, name: 'Fine Wheat Flour (Maida)', unit: 'kg', current_qty: 60, reorder_level: 15, is_active: true, created_at: new Date().toISOString() },
  { id: 'inv-7', branch_id: DEFAULT_BRANCH_ID, name: 'Buffalo Whole Milk', unit: 'Ltr', current_qty: 35, reorder_level: 10, is_active: true, created_at: new Date().toISOString() },
]

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-1',
    branch_id: DEFAULT_BRANCH_ID,
    inventory_item_id: 'inv-1',
    delta: 50,
    reason: 'purchase',
    note: 'Opening vendor shipment PO #KHI-PO-101',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    inventory_item: INITIAL_INVENTORY[0],
  },
  {
    id: 'sm-2',
    branch_id: DEFAULT_BRANCH_ID,
    inventory_item_id: 'inv-2',
    delta: -4.5,
    reason: 'sale',
    note: 'Kitchen recipe order consumption',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    inventory_item: INITIAL_INVENTORY[1],
  },
]

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Hamza Siddiqui',
    phone: '0333-2145678',
    email: 'hamza.siddiqui@gmail.com',
    address: 'House 45, Street 9, Phase 6 DHA, Karachi',
    notes: 'Prefers extra raita and salad with Biryani',
    total_orders: 8,
    total_spent: 12450,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    last_visit_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    marketing_consent: 'opted_in',
    marketing_consent_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    marketing_consent_source: 'pos',
  },
  {
    id: 'cust-2',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Dr. Ayesha Malik',
    phone: '0321-9876543',
    email: 'ayesha.malik@akuh.edu.pk',
    address: 'Apt 4B, Ocean Towers, Clifton, Karachi',
    notes: 'Hospital staff, fast delivery needed',
    total_orders: 5,
    total_spent: 8900,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    last_visit_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    marketing_consent: 'opted_in',
    marketing_consent_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    marketing_consent_source: 'reservation',
  },
  {
    id: 'cust-3',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Usman Ghani',
    phone: '0300-8219401',
    email: 'usman.ghani@consultant.pk',
    address: 'Office 702, Emerald Tower, Do Talwar, Karachi',
    notes: 'Corporate catering client',
    total_orders: 14,
    total_spent: 34200,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    last_visit_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    marketing_consent: 'opted_out',
    marketing_consent_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    marketing_consent_source: 'staff_update',
  },
]

export const INITIAL_DEALS: Deal[] = [
  {
    id: 'deal-1',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Karachi Biryani Duo Deal',
    description: '1 Chicken Biryani (Double Masala) + 1 Fresh Mint Lemonade combo at Rs. 550 (Save Rs. 110)',
    deal_type: 'combo',
    discount_type: 'combo_price',
    discount_value: 110,
    combo_price: 550,
    min_order_amount: 0,
    max_discount_amount: null,
    applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
    applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
    start_time: '2026-01-01T00:00:00.000Z',
    end_time: null,
    is_active: true,
    is_stackable: false,
    redemption_limit: 500,
    per_customer_limit: 3,
    times_redeemed: 42,
    internal_notes: 'Popular lunch & dinner combo',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    items: [
      {
        id: 'di-1',
        deal_id: 'deal-1',
        menu_item_id: 'item-2',
        required_quantity: 1,
        is_free: false,
      },
      {
        id: 'di-2',
        deal_id: 'deal-1',
        menu_item_id: 'item-8',
        required_quantity: 1,
        is_free: false,
      },
    ],
  },
  {
    id: 'deal-2',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'BOGO Seekh Kabab Feast',
    description: 'Buy one Beef Seekh Kabab (4 Pcs), get the second platter completely FREE!',
    deal_type: 'bogo',
    discount_type: 'free_item',
    discount_value: 450,
    combo_price: null,
    min_order_amount: 0,
    max_discount_amount: null,
    applicable_order_types: ['dine_in', 'takeaway'],
    applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
    start_time: '2026-01-01T00:00:00.000Z',
    end_time: null,
    is_active: true,
    is_stackable: false,
    redemption_limit: 200,
    per_customer_limit: 2,
    times_redeemed: 18,
    internal_notes: 'Promotes dine-in evening BBQ sales',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    items: [
      {
        id: 'di-3',
        deal_id: 'deal-2',
        menu_item_id: 'item-4',
        required_quantity: 2,
        is_free: true,
      },
    ],
  },
  {
    id: 'deal-3',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Flat Rs. 200 Off on Orders Above Rs. 1,500',
    description: 'Get an instant Rs. 200 off your entire bill on orders of Rs. 1,500 or more',
    deal_type: 'flat_discount',
    discount_type: 'fixed',
    discount_value: 200,
    combo_price: null,
    min_order_amount: 1500,
    max_discount_amount: null,
    applicable_order_types: ['dine_in', 'takeaway', 'delivery'],
    applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
    start_time: '2026-01-01T00:00:00.000Z',
    end_time: null,
    is_active: true,
    is_stackable: false,
    redemption_limit: 1000,
    per_customer_limit: 5,
    times_redeemed: 87,
    internal_notes: 'Drive higher ticket size',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'deal-4',
    branch_id: DEFAULT_BRANCH_ID,
    name: 'Family Feast 10% Off',
    description: '10% off your total bill for family dining and large gatherings over Rs. 2,500',
    deal_type: 'percentage_discount',
    discount_type: 'percentage',
    discount_value: 10,
    combo_price: null,
    min_order_amount: 2500,
    max_discount_amount: 600,
    applicable_order_types: ['dine_in', 'takeaway'],
    applicable_weekdays: [0, 1, 2, 3, 4, 5, 6],
    start_time: '2026-01-01T00:00:00.000Z',
    end_time: null,
    is_active: true,
    is_stackable: false,
    redemption_limit: 300,
    per_customer_limit: 2,
    times_redeemed: 34,
    internal_notes: 'Capped at Rs. 600 discount',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
]

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    branch_id: DEFAULT_BRANCH_ID,
    category: 'supplies',
    amount: 1800,
    payment_method: 'cash',
    description: 'Disposables, takeout bags and napkins',
    vendor: 'Korangi Packaging Mart',
    created_by: 'current-user',
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'exp-2',
    branch_id: DEFAULT_BRANCH_ID,
    category: 'utilities',
    amount: 4500,
    payment_method: 'cash',
    description: 'LPG cylinder refill for tandoor',
    vendor: 'Super Gas Clifton',
    created_by: 'current-user',
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
]

export const INITIAL_TABLES: DiningTable[] = [
  { id: 't-1', branch_id: DEFAULT_BRANCH_ID, label: 'Table 1 (Family)', seats: 6, is_active: true, location: 'Family Hall', current_order_id: 'ord-1', current_order_status: 'preparing' },
  { id: 't-2', branch_id: DEFAULT_BRANCH_ID, label: 'Table 2', seats: 4, is_active: true, location: 'Main Ground', current_order_id: null, current_order_status: null },
  { id: 't-3', branch_id: DEFAULT_BRANCH_ID, label: 'Table 3', seats: 4, is_active: true, location: 'Main Ground', current_order_id: 'ord-2', current_order_status: 'served' },
  { id: 't-4', branch_id: DEFAULT_BRANCH_ID, label: 'Table 4 (Booth)', seats: 4, is_active: true, location: 'VIP Lounge', current_order_id: null, current_order_status: null },
  { id: 't-5', branch_id: DEFAULT_BRANCH_ID, label: 'Table 5 (Corner)', seats: 2, is_active: true, location: 'Balcony', current_order_id: null, current_order_status: null },
  { id: 't-6', branch_id: DEFAULT_BRANCH_ID, label: 'Table 6 (Hall)', seats: 8, is_active: true, location: 'Family Hall', current_order_id: null, current_order_status: null },
]

export const INITIAL_RESERVATIONS: TableReservation[] = [
  {
    id: 'res-1',
    branch_id: DEFAULT_BRANCH_ID,
    table_id: 't-1',
    customer_name: 'Dr. Farhan Qureshi',
    customer_phone: '0300-1234567',
    guest_count: 5,
    reservation_time: new Date(Date.now() + 2 * 3600000).toISOString(),
    status: 'confirmed',
    notes: 'Family dinner, requested corner seating',
    created_at: new Date().toISOString(),
    table: INITIAL_TABLES[0],
  },
]

export const INITIAL_RECIPES: RecipeItem[] = [
  { id: 'rcp-1', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', inventory_item_id: 'inv-1', quantity: 0.3, unit: 'kg' },
  { id: 'rcp-2', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', inventory_item_id: 'inv-4', quantity: 0.35, unit: 'kg' },
  { id: 'rcp-3', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', inventory_item_id: 'inv-5', quantity: 0.05, unit: 'Ltr' },
  { id: 'rcp-4', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', inventory_item_id: 'inv-1', quantity: 0.25, unit: 'kg' },
  { id: 'rcp-5', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', inventory_item_id: 'inv-2', quantity: 0.35, unit: 'kg' },
  { id: 'rcp-6', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', inventory_item_id: 'inv-5', quantity: 0.05, unit: 'Ltr' },
  { id: 'rcp-7', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', inventory_item_id: 'inv-4', quantity: 1.0, unit: 'kg' },
  { id: 'rcp-8', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', inventory_item_id: 'inv-5', quantity: 0.15, unit: 'Ltr' },
  { id: 'rcp-9', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', inventory_item_id: 'inv-3', quantity: 0.3, unit: 'kg' },
  { id: 'rcp-10', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', inventory_item_id: 'inv-5', quantity: 0.03, unit: 'Ltr' },
  { id: 'rcp-11', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', inventory_item_id: 'inv-2', quantity: 0.35, unit: 'kg' },
  { id: 'rcp-12', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', inventory_item_id: 'inv-5', quantity: 0.02, unit: 'Ltr' },
  { id: 'rcp-13', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', inventory_item_id: 'inv-6', quantity: 0.15, unit: 'kg' },
  { id: 'rcp-14', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', inventory_item_id: 'inv-7', quantity: 0.03, unit: 'Ltr' },
  { id: 'rcp-15', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', inventory_item_id: 'inv-7', quantity: 0.2, unit: 'Ltr' },
]

export const INITIAL_STAFF: Profile[] = [
  { id: 'usr-1', branch_id: DEFAULT_BRANCH_ID, role: 'owner', full_name: 'Tariq Khan (Owner)', is_active: true, pin_set_at: new Date().toISOString() },
  { id: 'usr-2', branch_id: DEFAULT_BRANCH_ID, role: 'manager', full_name: 'Bilal Ahmed (Manager)', is_active: true, pin_set_at: new Date().toISOString() },
  { id: 'usr-3', branch_id: DEFAULT_BRANCH_ID, role: 'cashier', full_name: 'Zeeshan Ali (Cashier)', is_active: true, pin_set_at: new Date().toISOString() },
  { id: 'usr-4', branch_id: DEFAULT_BRANCH_ID, role: 'kitchen', full_name: 'Ustad Bashir (Head Chef)', is_active: true, pin_set_at: null },
  { id: 'usr-5', branch_id: DEFAULT_BRANCH_ID, role: 'waiter', full_name: 'Danish Raza (Waiter)', is_active: true, pin_set_at: null },
]

function getPastKarachiDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getKarachiBusinessDate(d)
}

function getPastISO(daysAgo: number, hoursOffset = 14): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hoursOffset, 15, 0, 0)
  return d.toISOString()
}

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1001,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1001',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-1',
    customer_name: 'Ahmed Raza',
    customer_phone: '0321-1234567',
    subtotal: 1500,
    discount: 0,
    tax: 195,
    total: 1695,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60000).toISOString(),
    items: [
      { id: 'oi-1', order_id: 'ord-1001', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 2, line_total: 960 },
      { id: 'oi-2', order_id: 'ord-1001', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', item_name: 'Beef Seekh Kabab (4 Pcs)', unit_price: 450, quantity: 1, line_total: 450 },
      { id: 'oi-3', order_id: 'ord-1001', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 1, line_total: 90 },
    ],
    payments: [
      { id: 'p-1', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1001', method: 'cash', status: 'succeeded', amount: 1695, idempotency_key: 'ik-1', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'ord-1020',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1020,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1020',
    type: 'delivery',
    status: 'completed',
    customer_name: 'Saima Khan',
    customer_phone: '0300-9876543',
    delivery_address: 'Bungalow 14, Khayaban-e-Shamsheer, Phase 5 DHA',
    subtotal: 3500,
    discount: 200,
    tax: 429,
    total: 3929,
    delivery_fee: 200,
    rider_cash_collected: 3929,
    rider_cash_handed_over: true,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 60000).toISOString(),
    items: [
      { id: 'oi-4', order_id: 'ord-1020', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', item_name: 'Mutton Shinwari Karahi (Full)', unit_price: 2600, quantity: 1, line_total: 2600 },
      { id: 'oi-5', order_id: 'ord-1020', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 4, line_total: 360 },
      { id: 'oi-6', order_id: 'ord-1020', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-8', item_name: 'Fresh Mint Lemonade', unit_price: 180, quantity: 3, line_total: 540 },
    ],
    payments: [
      { id: 'p-2', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1020', method: 'card', status: 'succeeded', amount: 3929, idempotency_key: 'ik-2', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'ord-1021',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1021,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1021',
    type: 'takeaway',
    status: 'cancelled',
    customer_name: 'Zubair Tariq',
    customer_phone: '0345-2233445',
    subtotal: 5000,
    discount: 0,
    tax: 650,
    total: 5650,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 150 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 120 * 60000).toISOString(),
    items: [
      { id: 'oi-7', order_id: 'ord-1021', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 850, quantity: 4, line_total: 3400 },
      { id: 'oi-8', order_id: 'ord-1021', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-5', item_name: 'Fish & Chips (British classic)', unit_price: 1200, quantity: 1, line_total: 1200 },
      { id: 'oi-9', order_id: 'ord-1021', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 3, line_total: 360 },
    ],
    payments: []
  },
  {
    id: 'ord-1022',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1022,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1022',
    type: 'dine_in',
    status: 'served',
    table_id: 't-3',
    customer_name: 'Dr. Ayesha Malik',
    customer_phone: '0321-9876543',
    subtotal: 1575,
    discount: 0,
    tax: 205,
    total: 1780,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
    items: [
      { id: 'oi-10', order_id: 'ord-1022', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 2, line_total: 960 },
      { id: 'oi-11', order_id: 'ord-1022', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', item_name: 'Chicken Tikka (Chest Piece)', unit_price: 380, quantity: 1, line_total: 380 },
      { id: 'oi-12', order_id: 'ord-1022', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-8', item_name: 'Fresh Mint Lemonade', unit_price: 180, quantity: 1, line_total: 180 },
    ],
    payments: [
      { id: 'p-3', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1022', method: 'cash', status: 'succeeded', amount: 1780, idempotency_key: 'ik-3', created_at: new Date().toISOString() }
    ],
    table: INITIAL_TABLES[2],
  },
  {
    id: 'ord-1023',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1023,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1023',
    type: 'takeaway',
    status: 'ready',
    customer_name: 'Hamza Siddiqui',
    customer_phone: '0333-2145678',
    subtotal: 841,
    discount: 0,
    tax: 109,
    total: 950,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60000).toISOString(),
    items: [
      { id: 'oi-13', order_id: 'ord-1023', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 850, quantity: 1, line_total: 850 },
    ],
    payments: [
      { id: 'p-4', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1023', method: 'card', status: 'succeeded', amount: 950, idempotency_key: 'ik-4', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'ord-1024',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1024,
    business_date: getKarachiBusinessDate(),
    client_request_id: 'req-1024',
    type: 'delivery',
    status: 'preparing',
    customer_name: 'Kamran Akmal',
    customer_phone: '0301-4455667',
    delivery_address: 'Flat 12, Gulshan Block 5, Karachi',
    subtotal: 2600,
    discount: 0,
    tax: 338,
    total: 2938,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'oi-14', order_id: 'ord-1024', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', item_name: 'Mutton Shinwari Karahi (Full)', unit_price: 2600, quantity: 1, line_total: 2600 },
    ],
    payments: []
  },
  // Historical orders for yesterday
  {
    id: 'ord-1015',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1015,
    business_date: getPastKarachiDate(1),
    client_request_id: 'req-1015',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-2',
    customer_name: 'Mian Tariq',
    customer_phone: '0300-4455667',
    subtotal: 4290,
    discount: 0,
    tax: 558,
    total: 4848,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(1, 14),
    updated_at: getPastISO(1, 15),
    items: [
      { id: 'oi-15', order_id: 'ord-1015', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 3, line_total: 1440 },
      { id: 'oi-16', order_id: 'ord-1015', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', item_name: 'Chicken Tikka (Chest Piece)', unit_price: 380, quantity: 4, line_total: 1520 },
      { id: 'oi-17', order_id: 'ord-1015', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 5, line_total: 450 },
      { id: 'oi-18', order_id: 'ord-1015', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 4, line_total: 480 },
      { id: 'oi-19', order_id: 'ord-1015', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-8', item_name: 'Fresh Mint Lemonade', unit_price: 180, quantity: 2, line_total: 400 },
    ],
    payments: [
      { id: 'p-1015', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1015', method: 'cash', status: 'succeeded', amount: 4848, idempotency_key: 'ik-1015', created_at: getPastISO(1, 15) }
    ],
    table: INITIAL_TABLES[1],
  },
  {
    id: 'ord-1016',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1016,
    business_date: getPastKarachiDate(1),
    client_request_id: 'req-1016',
    type: 'takeaway',
    status: 'completed',
    customer_name: 'Farhan Qureshi',
    customer_phone: '0322-9871234',
    subtotal: 2690,
    discount: 100,
    tax: 337,
    total: 2927,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(1, 16),
    updated_at: getPastISO(1, 16),
    items: [
      { id: 'oi-20', order_id: 'ord-1016', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', item_name: 'Mutton Shinwari Karahi (Full)', unit_price: 2600, quantity: 1, line_total: 2600 },
      { id: 'oi-21', order_id: 'ord-1016', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 1, line_total: 90 },
    ],
    payments: [
      { id: 'p-1016', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1016', method: 'jazzcash', status: 'succeeded', amount: 2927, idempotency_key: 'ik-1016', created_at: getPastISO(1, 16) }
    ]
  },
  {
    id: 'ord-1017',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1017,
    business_date: getPastKarachiDate(1),
    client_request_id: 'req-1017',
    type: 'delivery',
    status: 'completed',
    customer_name: 'Uzma Jahangir',
    customer_phone: '0334-5544332',
    delivery_address: 'House 8, DHA Phase 6, Karachi',
    subtotal: 3400,
    discount: 0,
    tax: 442,
    delivery_fee: 150,
    total: 3992,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(1, 19),
    updated_at: getPastISO(1, 20),
    items: [
      { id: 'oi-22', order_id: 'ord-1017', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 850, quantity: 4, line_total: 3400 },
    ],
    payments: [
      { id: 'p-1017', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1017', method: 'card', status: 'succeeded', amount: 3992, idempotency_key: 'ik-1017', created_at: getPastISO(1, 20) }
    ]
  },
  {
    id: 'ord-1018',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1018,
    business_date: getPastKarachiDate(1),
    client_request_id: 'req-1018',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-4',
    customer_name: 'Kashif Memon',
    customer_phone: '0312-3322110',
    subtotal: 2170,
    discount: 50,
    tax: 276,
    total: 2396,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(1, 21),
    updated_at: getPastISO(1, 22),
    items: [
      { id: 'oi-23', order_id: 'ord-1018', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', item_name: 'Beef Seekh Kabab (4 Pcs)', unit_price: 450, quantity: 2, line_total: 900 },
      { id: 'oi-24', order_id: 'ord-1018', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', item_name: 'Chicken Tikka (Chest Piece)', unit_price: 380, quantity: 2, line_total: 760 },
      { id: 'oi-25', order_id: 'ord-1018', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 3, line_total: 270 },
      { id: 'oi-26', order_id: 'ord-1018', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 2, line_total: 240 },
    ],
    payments: [
      { id: 'p-1018', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1018', method: 'easypaisa', status: 'succeeded', amount: 2396, idempotency_key: 'ik-1018', created_at: getPastISO(1, 22) }
    ],
    table: INITIAL_TABLES[3],
  },
  // Orders from 2 days ago
  {
    id: 'ord-1011',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1011,
    business_date: getPastKarachiDate(2),
    client_request_id: 'req-1011',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-1',
    customer_name: 'Zia Ul Haq',
    customer_phone: '0345-1122998',
    subtotal: 3300,
    discount: 0,
    tax: 429,
    total: 3729,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(2, 13),
    updated_at: getPastISO(2, 14),
    items: [
      { id: 'oi-27', order_id: 'ord-1011', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 4, line_total: 1920 },
      { id: 'oi-28', order_id: 'ord-1011', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', item_name: 'Beef Seekh Kabab (4 Pcs)', unit_price: 450, quantity: 2, line_total: 900 },
      { id: 'oi-29', order_id: 'ord-1011', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-8', item_name: 'Fresh Mint Lemonade', unit_price: 180, quantity: 2, line_total: 360 },
      { id: 'oi-30', order_id: 'ord-1011', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 1, line_total: 90 },
    ],
    payments: [
      { id: 'p-1011', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1011', method: 'cash', status: 'succeeded', amount: 3729, idempotency_key: 'ik-1011', created_at: getPastISO(2, 14) }
    ],
    table: INITIAL_TABLES[0],
  },
  {
    id: 'ord-1012',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1012,
    business_date: getPastKarachiDate(2),
    client_request_id: 'req-1012',
    type: 'delivery',
    status: 'completed',
    customer_name: 'Nadia Hussain',
    customer_phone: '0300-8877665',
    delivery_address: 'Bungalow 22, Tipu Sultan Road, Karachi',
    subtotal: 5000,
    discount: 200,
    tax: 624,
    delivery_fee: 180,
    total: 5604,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(2, 20),
    updated_at: getPastISO(2, 21),
    items: [
      { id: 'oi-31', order_id: 'ord-1012', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', item_name: 'Mutton Shinwari Karahi (Full)', unit_price: 2600, quantity: 1, line_total: 2600 },
      { id: 'oi-32', order_id: 'ord-1012', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-5', item_name: 'Fish & Chips (British classic)', unit_price: 1200, quantity: 2, line_total: 2400 },
    ],
    payments: [
      { id: 'p-1012', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1012', method: 'card', status: 'succeeded', amount: 5604, idempotency_key: 'ik-1012', created_at: getPastISO(2, 21) }
    ]
  },
  // Orders from 3 days ago
  {
    id: 'ord-1008',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1008,
    business_date: getPastKarachiDate(3),
    client_request_id: 'req-1008',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-3',
    customer_name: 'Salman Butt',
    customer_phone: '0321-4433221',
    subtotal: 5100,
    discount: 0,
    tax: 663,
    total: 5763,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(3, 14),
    updated_at: getPastISO(3, 15),
    items: [
      { id: 'oi-33', order_id: 'ord-1008', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 850, quantity: 6, line_total: 5100 },
    ],
    payments: [
      { id: 'p-1008', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1008', method: 'cash', status: 'succeeded', amount: 5763, idempotency_key: 'ik-1008', created_at: getPastISO(3, 15) }
    ],
    table: INITIAL_TABLES[2],
  },
  {
    id: 'ord-1009',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1009,
    business_date: getPastKarachiDate(3),
    client_request_id: 'req-1009',
    type: 'takeaway',
    status: 'completed',
    customer_name: 'Junaid Khan',
    customer_phone: '0333-7788990',
    subtotal: 2470,
    discount: 0,
    tax: 321,
    total: 2791,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(3, 18),
    updated_at: getPastISO(3, 19),
    items: [
      { id: 'oi-34', order_id: 'ord-1009', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', item_name: 'Chicken Tikka (Chest Piece)', unit_price: 380, quantity: 4, line_total: 1520 },
      { id: 'oi-35', order_id: 'ord-1009', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 5, line_total: 450 },
      { id: 'oi-36', order_id: 'ord-1009', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 4, line_total: 480 },
    ],
    payments: [
      { id: 'p-1009', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1009', method: 'jazzcash', status: 'succeeded', amount: 2791, idempotency_key: 'ik-1009', created_at: getPastISO(3, 19) }
    ]
  },
  // Orders from 5 days ago
  {
    id: 'ord-1005',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1005,
    business_date: getPastKarachiDate(5),
    client_request_id: 'req-1005',
    type: 'delivery',
    status: 'completed',
    customer_name: 'Sadia Faisal',
    customer_phone: '0302-6655443',
    delivery_address: 'Apartment 4B, Clifton Block 2, Karachi',
    subtotal: 3810,
    discount: 100,
    tax: 482,
    delivery_fee: 150,
    total: 4342,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(5, 13),
    updated_at: getPastISO(5, 14),
    items: [
      { id: 'oi-37', order_id: 'ord-1005', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-5', item_name: 'Fish & Chips (British classic)', unit_price: 1200, quantity: 1, line_total: 1200 },
      { id: 'oi-38', order_id: 'ord-1005', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 3, line_total: 1440 },
      { id: 'oi-39', order_id: 'ord-1005', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 3, line_total: 270 },
      { id: 'oi-40', order_id: 'ord-1005', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-8', item_name: 'Fresh Mint Lemonade', unit_price: 180, quantity: 5, line_total: 900 },
    ],
    payments: [
      { id: 'p-1005', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1005', method: 'easypaisa', status: 'succeeded', amount: 4342, idempotency_key: 'ik-1005', created_at: getPastISO(5, 14) }
    ]
  },
  {
    id: 'ord-1006',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1006,
    business_date: getPastKarachiDate(5),
    client_request_id: 'req-1006',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-2',
    customer_name: 'Hassan Mir',
    customer_phone: '0346-9900112',
    subtotal: 2880,
    discount: 0,
    tax: 374,
    total: 3254,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(5, 20),
    updated_at: getPastISO(5, 21),
    items: [
      { id: 'oi-41', order_id: 'ord-1006', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', item_name: 'Beef Seekh Kabab (4 Pcs)', unit_price: 450, quantity: 4, line_total: 1800 },
      { id: 'oi-42', order_id: 'ord-1006', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 4, line_total: 360 },
      { id: 'oi-43', order_id: 'ord-1006', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 6, line_total: 720 },
    ],
    payments: [
      { id: 'p-1006', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1006', method: 'card', status: 'succeeded', amount: 3254, idempotency_key: 'ik-1006', created_at: getPastISO(5, 21) }
    ],
    table: INITIAL_TABLES[1],
  },
  // Order from 10 days ago
  {
    id: 'ord-1000',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 1000,
    business_date: getPastKarachiDate(10),
    client_request_id: 'req-1000',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-5',
    customer_name: 'Tariq Mehmood',
    customer_phone: '0300-3322114',
    subtotal: 6100,
    discount: 200,
    tax: 767,
    total: 6667,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(10, 19),
    updated_at: getPastISO(10, 20),
    items: [
      { id: 'oi-44', order_id: 'ord-1000', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-3', item_name: 'Mutton Shinwari Karahi (Full)', unit_price: 2600, quantity: 2, line_total: 5200 },
      { id: 'oi-45', order_id: 'ord-1000', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-7', item_name: 'Garlic Roghani Naan', unit_price: 90, quantity: 10, line_total: 900 },
    ],
    payments: [
      { id: 'p-1000', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-1000', method: 'card', status: 'succeeded', amount: 6667, idempotency_key: 'ik-1000', created_at: getPastISO(10, 20) }
    ],
    table: INITIAL_TABLES[4],
  },
  // Order from 18 days ago
  {
    id: 'ord-990',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 990,
    business_date: getPastKarachiDate(18),
    client_request_id: 'req-990',
    type: 'delivery',
    status: 'completed',
    customer_name: 'Mehvish Khan',
    customer_phone: '0321-7766554',
    delivery_address: 'House 55, Gulshan Block 13D, Karachi',
    subtotal: 4250,
    discount: 150,
    tax: 533,
    delivery_fee: 150,
    total: 4783,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(18, 14),
    updated_at: getPastISO(18, 15),
    items: [
      { id: 'oi-46', order_id: 'ord-990', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-1', item_name: 'Special Mutton Dum Biryani', unit_price: 850, quantity: 5, line_total: 4250 },
    ],
    payments: [
      { id: 'p-990', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-990', method: 'jazzcash', status: 'succeeded', amount: 4783, idempotency_key: 'ik-990', created_at: getPastISO(18, 15) }
    ]
  },
  // Order from 25 days ago
  {
    id: 'ord-980',
    branch_id: DEFAULT_BRANCH_ID,
    order_number: 980,
    business_date: getPastKarachiDate(25),
    client_request_id: 'req-980',
    type: 'dine_in',
    status: 'completed',
    table_id: 't-1',
    customer_name: 'Haroon Rashid',
    customer_phone: '0334-1122339',
    subtotal: 5680,
    discount: 0,
    tax: 738,
    total: 6418,
    delivery_fee: 0,
    rider_cash_collected: 0,
    rider_cash_handed_over: false,
    created_by: 'usr-3',
    created_at: getPastISO(25, 20),
    updated_at: getPastISO(25, 21),
    items: [
      { id: 'oi-47', order_id: 'ord-980', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-2', item_name: 'Chicken Biryani (Double Masala)', unit_price: 480, quantity: 5, line_total: 2400 },
      { id: 'oi-48', order_id: 'ord-980', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-4', item_name: 'Beef Seekh Kabab (4 Pcs)', unit_price: 450, quantity: 4, line_total: 1800 },
      { id: 'oi-49', order_id: 'ord-980', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-6', item_name: 'Chicken Tikka (Chest Piece)', unit_price: 380, quantity: 2, line_total: 760 },
      { id: 'oi-50', order_id: 'ord-980', branch_id: DEFAULT_BRANCH_ID, menu_item_id: 'item-9', item_name: 'Karak Doodh Patti Chai', unit_price: 120, quantity: 6, line_total: 720 },
    ],
    payments: [
      { id: 'p-980', branch_id: DEFAULT_BRANCH_ID, order_id: 'ord-980', method: 'cash', status: 'succeeded', amount: 6418, idempotency_key: 'ik-980', created_at: getPastISO(25, 21) }
    ],
    table: INITIAL_TABLES[0],
  }
]

// Generic Local Storage helper with fallback
function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback))
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('karachi-pos-update', { detail: { key } }))
    window.dispatchEvent(new CustomEvent('karachi_storage_update', { detail: { key } }))
  } catch {
    // ignore quota
  }
}

// -------------------------------------------------------------
// Inventory & Restock Repository
// -------------------------------------------------------------
export const Storage = {
  // Inventory
  getInventory(branchId: string): InventoryItem[] {
    const all = getStored<InventoryItem[]>('kpos_inventory', INITIAL_INVENTORY)
    return all.filter((i) => i.branch_id === branchId || !i.branch_id)
  },

  restockItem(
    branchId: string,
    itemId: string,
    quantity: number,
    cost?: number,
    supplier?: string,
    note?: string
  ): { movement: StockMovement; item: InventoryItem } {
    if (quantity <= 0) throw new Error('Restock quantity must be greater than zero')
    const allItems = getStored<InventoryItem[]>('kpos_inventory', INITIAL_INVENTORY)
    const idx = allItems.findIndex((i) => i.id === itemId)
    if (idx === -1) throw new Error('Inventory item not found')

    const item = allItems[idx]
    const newQty = Number((item.current_qty + quantity).toFixed(3))
    const updatedItem = { ...item, current_qty: newQty }
    allItems[idx] = updatedItem
    setStored('kpos_inventory', allItems)

    const auditNote = [
      `Restocked +${quantity} ${item.unit}`,
      cost ? `Cost: PKR ${cost}` : null,
      supplier ? `Supplier: ${supplier}` : null,
      note ? `Note: ${note}` : null,
    ].filter(Boolean).join(' | ')

    const movement: StockMovement = {
      id: 'sm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      branch_id: branchId,
      inventory_item_id: itemId,
      delta: quantity,
      reason: 'purchase',
      note: auditNote,
      created_at: new Date().toISOString(),
      inventory_item: updatedItem,
    }

    const movements = getStored<StockMovement[]>('kpos_stock_movements', INITIAL_STOCK_MOVEMENTS)
    movements.unshift(movement)
    setStored('kpos_stock_movements', movements)

    return { movement, item: updatedItem }
  },

  adjustStock(
    branchId: string,
    itemId: string,
    delta: number,
    reason: StockReason,
    note?: string
  ): { movement: StockMovement; item: InventoryItem } {
    if (delta === 0) throw new Error('Stock delta cannot be zero')
    const allItems = getStored<InventoryItem[]>('kpos_inventory', INITIAL_INVENTORY)
    const idx = allItems.findIndex((i) => i.id === itemId)
    if (idx === -1) throw new Error('Inventory item not found')

    const item = allItems[idx]
    const newQty = Number((item.current_qty + delta).toFixed(3))
    if (newQty < 0) throw new Error(`Stock cannot drop below zero (Current: ${item.current_qty} ${item.unit})`)

    const updatedItem = { ...item, current_qty: newQty }
    allItems[idx] = updatedItem
    setStored('kpos_inventory', allItems)

    const movement: StockMovement = {
      id: 'sm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      branch_id: branchId,
      inventory_item_id: itemId,
      delta,
      reason,
      note: note || `Manual adjustment: ${reason}`,
      created_at: new Date().toISOString(),
      inventory_item: updatedItem,
    }

    const movements = getStored<StockMovement[]>('kpos_stock_movements', INITIAL_STOCK_MOVEMENTS)
    movements.unshift(movement)
    setStored('kpos_stock_movements', movements)

    return { movement, item: updatedItem }
  },

  getStockMovements(branchId: string): StockMovement[] {
    const all = getStored<StockMovement[]>('kpos_stock_movements', INITIAL_STOCK_MOVEMENTS)
    const items = Storage.getInventory(branchId)
    return all
      .filter((m) => m.branch_id === branchId || !m.branch_id)
      .map((m) => ({
        ...m,
        inventory_item: m.inventory_item || items.find((i) => i.id === m.inventory_item_id),
      }))
  },

  // Recipes
  getRecipes(branchId: string): RecipeItem[] {
    const all = getStored<RecipeItem[]>('kpos_recipes', INITIAL_RECIPES)
    const items = Storage.getInventory(branchId)
    return all
      .filter((r) => r.branch_id === branchId || !r.branch_id)
      .map((r) => ({
        ...r,
        inventory_item: items.find((i) => i.id === r.inventory_item_id),
      }))
  },

  saveRecipeItem(
    branchId: string,
    menuItemId: string,
    inventoryItemId: string,
    quantity: number,
    unit: string
  ): RecipeItem {
    if (quantity <= 0) throw new Error('Recipe quantity must be positive')
    const list = getStored<RecipeItem[]>('kpos_recipes', INITIAL_RECIPES)
    const items = Storage.getInventory(branchId)
    const invItem = items.find((i) => i.id === inventoryItemId)
    const idx = list.findIndex(
      (r) => r.branch_id === branchId && r.menu_item_id === menuItemId && r.inventory_item_id === inventoryItemId
    )

    let saved: RecipeItem
    if (idx >= 0) {
      saved = { ...list[idx], quantity, unit, inventory_item: invItem }
      list[idx] = saved
    } else {
      saved = {
        id: 'rcp-' + Date.now(),
        branch_id: branchId,
        menu_item_id: menuItemId,
        inventory_item_id: inventoryItemId,
        quantity,
        unit,
        inventory_item: invItem,
      }
      list.push(saved)
    }

    setStored('kpos_recipes', list)
    return saved
  },

  // Customers
  getCustomers(
    branchId: string,
    searchOrFilter?: string | { search?: string; marketing_consent?: MarketingConsent | 'all' },
    consentFilter?: MarketingConsent | 'all'
  ): Customer[] {
    let list = getStored<Customer[]>('kpos_customers', INITIAL_CUSTOMERS)
    list = list.filter((c) => c.branch_id === branchId || !c.branch_id)

    let actualSearch: string | undefined
    let actualConsent: MarketingConsent | 'all' | undefined = consentFilter

    if (typeof searchOrFilter === 'object' && searchOrFilter !== null) {
      actualSearch = searchOrFilter.search
      if (searchOrFilter.marketing_consent) {
        actualConsent = searchOrFilter.marketing_consent
      }
    } else if (typeof searchOrFilter === 'string') {
      actualSearch = searchOrFilter
    }

    if (actualConsent && actualConsent !== 'all') {
      list = list.filter((c) => (c.marketing_consent || 'unspecified') === actualConsent)
    }

    if (actualSearch?.trim()) {
      const q = actualSearch.trim().toLowerCase()
      const qPhone = normalizePhoneNumber(q).replace('+', '')
      list = list.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q)
        const phoneMatch = c.phone.includes(q) || (c.phone && normalizePhoneNumber(c.phone).includes(qPhone))
        return nameMatch || phoneMatch
      })
    }

    return list
  },

  saveCustomer(branchId: string, customer: Partial<Customer>): Customer {
    if (!customer.name?.trim()) throw new Error('Customer name is required')
    if (!customer.phone?.trim()) throw new Error('Customer phone number is required')

    const all = getStored<Customer[]>('kpos_customers', INITIAL_CUSTOMERS)
    const phoneClean = customer.phone.trim()
    const normalizedPhone = normalizePhoneNumber(phoneClean)

    const existingIndex = all.findIndex((c) => {
      if (c.branch_id !== branchId && c.branch_id) return false
      return normalizePhoneNumber(c.phone) === normalizedPhone || c.phone.replace(/[\s-]/g, '') === phoneClean.replace(/[\s-]/g, '')
    })

    let saved: Customer
    if (existingIndex >= 0) {
      saved = {
        ...all[existingIndex],
        name: customer.name.trim(),
        phone: phoneClean,
        email: customer.email !== undefined ? (customer.email?.trim() || null) : all[existingIndex].email,
        address: customer.address !== undefined ? (customer.address?.trim() || null) : all[existingIndex].address,
        notes: customer.notes !== undefined ? (customer.notes?.trim() || null) : all[existingIndex].notes,
        marketing_consent: customer.marketing_consent !== undefined ? customer.marketing_consent : (all[existingIndex].marketing_consent || 'unspecified'),
        marketing_consent_at: customer.marketing_consent !== undefined ? new Date().toISOString() : all[existingIndex].marketing_consent_at,
        marketing_consent_source: customer.marketing_consent_source || all[existingIndex].marketing_consent_source || 'staff_update',
        last_visit_at: customer.last_visit_at || all[existingIndex].last_visit_at,
        last_order_at: customer.last_order_at || all[existingIndex].last_order_at,
        last_reservation_at: customer.last_reservation_at || all[existingIndex].last_reservation_at,
        total_orders: customer.total_orders !== undefined ? customer.total_orders : all[existingIndex].total_orders,
        total_spent: customer.total_spent !== undefined ? customer.total_spent : all[existingIndex].total_spent,
      }
      all[existingIndex] = saved
    } else {
      saved = {
        id: customer.id || 'cust-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        branch_id: branchId,
        name: customer.name.trim(),
        phone: phoneClean,
        email: customer.email?.trim() || null,
        address: customer.address?.trim() || null,
        notes: customer.notes?.trim() || null,
        total_orders: customer.total_orders || 0,
        total_spent: customer.total_spent || 0,
        marketing_consent: customer.marketing_consent || 'unspecified',
        marketing_consent_at: customer.marketing_consent ? new Date().toISOString() : null,
        marketing_consent_source: customer.marketing_consent_source || 'direct',
        last_visit_at: customer.last_visit_at || null,
        last_order_at: customer.last_order_at || null,
        last_reservation_at: customer.last_reservation_at || null,
        created_at: new Date().toISOString(),
      }
      all.unshift(saved)
    }

    setStored('kpos_customers', all)
    return saved
  },

  updateCustomerConsent(
    arg1: string,
    arg2: string | MarketingConsent,
    arg3?: string | MarketingConsent,
    arg4?: string
  ): void {
    let customerId: string
    let consent: MarketingConsent
    let source = 'staff_update'

    if (arg3 === 'opted_in' || arg3 === 'opted_out' || arg3 === 'unspecified') {
      customerId = arg2 as string
      consent = arg3
      if (arg4) source = arg4
    } else {
      customerId = arg1
      consent = arg2 as MarketingConsent
      if (typeof arg3 === 'string') source = arg3
    }

    const all = getStored<Customer[]>('kpos_customers', INITIAL_CUSTOMERS)
    const idx = all.findIndex((c) => c.id === customerId)
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        marketing_consent: consent,
        marketing_consent_at: new Date().toISOString(),
        marketing_consent_source: source,
      }
      setStored('kpos_customers', all)
    }
  },

  // Expenses
  getExpenses(branchId: string): Expense[] {
    const list = getStored<Expense[]>('kpos_expenses', INITIAL_EXPENSES)
    return list.filter((e) => e.branch_id === branchId || !e.branch_id)
  },

  recordExpense(params: {
    branchId: string
    category: Expense['category']
    amount: number
    paymentMethod: PaymentMethod
    cashSessionId?: string | null
    description: string
    vendor?: string | null
  }): Expense {
    if (params.amount <= 0) throw new Error('Expense amount must be greater than zero')
    if (!params.description.trim()) throw new Error('Expense description is required')

    const expense: Expense = {
      id: 'exp-' + Date.now(),
      branch_id: params.branchId,
      category: params.category,
      amount: params.amount,
      payment_method: params.paymentMethod,
      cash_session_id: params.cashSessionId || null,
      description: params.description.trim(),
      vendor: params.vendor?.trim() || null,
      created_by: 'current-user',
      created_at: new Date().toISOString(),
    }

    const list = getStored<Expense[]>('kpos_expenses', INITIAL_EXPENSES)
    list.unshift(expense)
    setStored('kpos_expenses', list)
    return expense
  },

  // Tables
  getTables(branchId: string): DiningTable[] {
    const list = getStored<DiningTable[]>('kpos_tables', INITIAL_TABLES)
    return list.filter((t) => t.branch_id === branchId || !t.branch_id)
  },

  saveTable(branchId: string, table: Partial<DiningTable>): DiningTable {
    if (!table.label?.trim()) throw new Error('Table name/number is required')
    const seats = Number(table.seats) || 4
    if (seats <= 0) throw new Error('Seats must be at least 1')

    const list = getStored<DiningTable[]>('kpos_tables', INITIAL_TABLES)
    
    // Check uniqueness within branch
    const dup = list.find((t) => t.branch_id === branchId && t.label.trim().toLowerCase() === table.label!.trim().toLowerCase() && t.id !== table.id)
    if (dup) throw new Error(`Table with label "${table.label}" already exists in this branch`)

    let saved: DiningTable
    if (table.id) {
      const idx = list.findIndex((t) => t.id === table.id)
      if (idx === -1) throw new Error('Table not found')
      saved = {
        ...list[idx],
        label: table.label.trim(),
        seats,
        location: table.location || list[idx].location,
        is_active: table.is_active ?? list[idx].is_active,
      }
      list[idx] = saved
    } else {
      saved = {
        id: 't-' + Date.now(),
        branch_id: branchId,
        label: table.label.trim(),
        seats,
        location: table.location || 'Dining Hall',
        is_active: true,
        current_order_id: null,
        current_order_status: null,
      }
      list.push(saved)
    }

    setStored('kpos_tables', list)
    return saved
  },

  updateTableStatus(tableId: string, currentOrderId: string | null, status: OrderStatus | null): void {
    const list = getStored<DiningTable[]>('kpos_tables', INITIAL_TABLES)
    const idx = list.findIndex((t) => t.id === tableId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], current_order_id: currentOrderId, current_order_status: status }
      setStored('kpos_tables', list)
    }
  },

  // Reservations
  getReservations(branchId: string): TableReservation[] {
    const list = getStored<TableReservation[]>('kpos_reservations', INITIAL_RESERVATIONS)
    const tables = Storage.getTables(branchId)
    const customers = Storage.getCustomers(branchId)
    return list
      .filter((r) => r.branch_id === branchId || !r.branch_id)
      .map((r) => ({
        ...r,
        table: tables.find((t) => t.id === r.table_id) || r.table,
        customer: customers.find((c) => c.id === r.customer_id) || r.customer,
      }))
  },

  saveReservation(branchId: string, res: {
    id?: string
    tableId?: string
    table_id?: string
    customerName?: string
    customer_name?: string
    customerPhone?: string
    customer_phone?: string
    guestCount?: number
    guest_count?: number
    party_size?: number
    reservationTime?: string
    reservation_time?: string
    reservation_date?: string
    notes?: string
    status?: TableReservation['status']
    customerId?: string
    customer_id?: string
    marketingConsent?: MarketingConsent
    marketing_consent?: MarketingConsent
  }): TableReservation {
    const rawName = (res.customerName || res.customer_name || '').trim()
    const rawPhone = (res.customerPhone || res.customer_phone || '').trim()
    const customerName = rawName || 'Guest'
    const guestCount = res.guestCount ?? res.guest_count ?? res.party_size ?? 2
    if (guestCount <= 0) throw new Error('Guest count must be at least 1')

    let timeStr: string
    if (res.reservationTime) {
      timeStr = res.reservationTime
    } else if (res.reservation_date && res.reservation_time && !res.reservation_time.includes('T')) {
      const timePart = res.reservation_time.length === 5 ? `${res.reservation_time}:00` : res.reservation_time
      timeStr = `${res.reservation_date}T${timePart}Z`
    } else if (res.reservation_time) {
      timeStr = res.reservation_time
    } else if (res.reservation_date) {
      timeStr = `${res.reservation_date}T19:30:00Z`
    } else {
      timeStr = new Date().toISOString()
    }

    const resDate = new Date(timeStr)
    if (isNaN(resDate.getTime())) throw new Error('Invalid reservation date and time')

    const list = getStored<TableReservation[]>('kpos_reservations', INITIAL_RESERVATIONS)
    const tables = Storage.getTables(branchId)
    const targetTableId = res.tableId || res.table_id || (tables[0]?.id || 'tbl-1')
    const table = tables.find((t) => t.id === targetTableId)

    // Check for conflict (within 2 hours for same table, unless cancelled)
    const conflict = list.find((existing) => {
      if (existing.id === res.id) return false
      if (existing.table_id !== targetTableId) return false
      if (existing.status === 'cancelled' || existing.status === 'completed') return false
      const diffMinutes = Math.abs((new Date(existing.reservation_time).getTime() - resDate.getTime()) / 60000)
      return diffMinutes < 120 // Within 2 hours
    })

    if (conflict) {
      throw new Error(`Table reservation conflict: Table ${table?.label || 'selected'} already has a booking (${conflict.customer_name}) at ${new Date(conflict.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please choose another table or time slot.`)
    }

    // Auto-match or create customer profile if phone is supplied
    let linkedCustomerId: string | null = res.customerId || res.customer_id || null
    const consent = res.marketingConsent || res.marketing_consent

    if (rawPhone) {
      const normalizedPhone = normalizePhoneNumber(rawPhone)
      const allCustomers = Storage.getCustomers(branchId)
      const matchedCustomer = allCustomers.find((c) => normalizePhoneNumber(c.phone) === normalizedPhone)

      if (matchedCustomer) {
        linkedCustomerId = matchedCustomer.id
        Storage.saveCustomer(branchId, {
          id: matchedCustomer.id,
          name: matchedCustomer.name || customerName,
          phone: matchedCustomer.phone,
          last_visit_at: resDate.toISOString(),
          last_reservation_at: resDate.toISOString(),
          marketing_consent: consent || matchedCustomer.marketing_consent,
          marketing_consent_source: consent ? 'reservation' : matchedCustomer.marketing_consent_source,
        })
      } else {
        const newCustomer = Storage.saveCustomer(branchId, {
          name: customerName,
          phone: rawPhone,
          marketing_consent: consent || 'unspecified',
          marketing_consent_source: 'reservation',
          last_visit_at: resDate.toISOString(),
          last_reservation_at: resDate.toISOString(),
          notes: res.notes ? `Reservation request: ${res.notes.trim()}` : null,
        })
        linkedCustomerId = newCustomer.id
      }
    }

    let saved: TableReservation
    if (res.id) {
      const idx = list.findIndex((r) => r.id === res.id)
      if (idx === -1) throw new Error('Reservation not found')
      saved = {
        ...list[idx],
        table_id: targetTableId,
        customer_id: linkedCustomerId || list[idx].customer_id,
        customer_name: customerName,
        customer_phone: rawPhone,
        guest_count: guestCount,
        reservation_time: resDate.toISOString(),
        notes: res.notes !== undefined ? (res.notes?.trim() || null) : list[idx].notes,
        status: res.status || list[idx].status,
        table,
      }
      list[idx] = saved
    } else {
      saved = {
        id: 'res-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        branch_id: branchId,
        table_id: targetTableId,
        customer_id: linkedCustomerId,
        customer_name: customerName,
        customer_phone: rawPhone,
        guest_count: guestCount,
        reservation_time: resDate.toISOString(),
        status: res.status || 'confirmed',
        notes: res.notes?.trim() || null,
        created_at: new Date().toISOString(),
        table,
      }
      list.unshift(saved)
    }

    setStored('kpos_reservations', list)
    return saved
  },

  updateReservationStatus(resId: string, status: TableReservation['status']): void {
    const list = getStored<TableReservation[]>('kpos_reservations', INITIAL_RESERVATIONS)
    const idx = list.findIndex((r) => r.id === resId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], status }
      setStored('kpos_reservations', list)
    }
  },

  // Staff
  getStaff(branchId: string): Profile[] {
    const list = getStored<Profile[]>('kpos_staff', INITIAL_STAFF)
    return list.filter((s) => s.branch_id === branchId || s.role === 'owner')
  },

  saveStaff(branchId: string, staff: {
    fullName: string
    role: AppRole
    email?: string
  }): Profile {
    if (!staff.fullName.trim()) throw new Error('Staff name is required')

    const list = getStored<Profile[]>('kpos_staff', INITIAL_STAFF)
    const newStaff: Profile = {
      id: 'usr-' + Date.now(),
      branch_id: branchId,
      role: staff.role,
      full_name: staff.fullName.trim(),
      pin_set_at: null,
      is_active: true,
    }

    list.push(newStaff)
    setStored('kpos_staff', list)
    return newStaff
  },

  setStaffPin(userId: string): void {
    const list = getStored<Profile[]>('kpos_staff', INITIAL_STAFF)
    const idx = list.findIndex((s) => s.id === userId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], pin_set_at: new Date().toISOString() }
      setStored('kpos_staff', list)
    }
  },

  // Categories & Menu Items
  getCategories(branchId: string): MenuCategory[] {
    const list = getStored<MenuCategory[]>('kpos_categories', INITIAL_CATEGORIES)
    return list.filter((c) => c.branch_id === branchId || !c.branch_id)
  },

  saveCategory(branchId: string, name: string, sortOrder = 0): MenuCategory {
    if (!name.trim()) throw new Error('Category name is required')
    const list = getStored<MenuCategory[]>('kpos_categories', INITIAL_CATEGORIES)
    const dup = list.find((c) => c.branch_id === branchId && c.name.toLowerCase() === name.trim().toLowerCase())
    if (dup) throw new Error(`Category "${name}" already exists`)

    const newCat: MenuCategory = {
      id: 'cat-' + Date.now(),
      branch_id: branchId,
      name: name.trim(),
      sort_order: sortOrder || list.length + 1,
      is_active: true,
    }

    list.push(newCat)
    setStored('kpos_categories', list)
    return newCat
  },

  getMenuItems(branchId: string): MenuItem[] {
    const list = getStored<MenuItem[]>('kpos_menu_items', INITIAL_MENU_ITEMS)

    // Migration map for authentic dishes
    const DISH_IMAGE_CORRECTIONS: Record<string, string> = {
      'item-1': '/dishes/mutton_biryani.jpg',
      'item-2': '/dishes/chicken_biryani.jpg',
      'item-3': '/dishes/mutton_karahi.jpg',
      'item-4': '/dishes/beef_kabab.jpg',
      'item-5': '/dishes/fish_chips.jpg',
      'item-6': '/dishes/chicken_tikka.jpg',
      'item-7': '/dishes/garlic_naan.jpg',
      'item-8': '/dishes/mint_lemonade.jpg',
      'item-9': '/dishes/karak_chai.jpg',
    }

    let modified = false
    const upgraded = list.map((item) => {
      const correctImage = DISH_IMAGE_CORRECTIONS[item.id]
      if (correctImage && (!item.image_url || item.image_url.includes('unsplash.com'))) {
        modified = true
        return { ...item, image_url: correctImage }
      }
      return item
    })

    if (modified) {
      setStored('kpos_menu_items', upgraded)
    }

    return upgraded.filter((i) => i.branch_id === branchId || !i.branch_id)
  },

  saveMenuItem(branchId: string, item: Partial<MenuItem>): MenuItem {
    if (!item.name?.trim()) throw new Error('Dish name is required')
    if (!item.category_id) throw new Error('Category selection is required')
    if (typeof item.price !== 'number' || item.price < 0) throw new Error('Valid price is required')

    const list = getStored<MenuItem[]>('kpos_menu_items', INITIAL_MENU_ITEMS)
    let saved: MenuItem

    if (item.id) {
      const idx = list.findIndex((i) => i.id === item.id)
      if (idx === -1) throw new Error('Dish not found')
      saved = {
        ...list[idx],
        name: item.name.trim(),
        category_id: item.category_id,
        price: item.price,
        description: item.description?.trim() || null,
        image_url: item.image_url || list[idx].image_url,
        is_available: item.is_available ?? list[idx].is_available,
      }
      list[idx] = saved
    } else {
      saved = {
        id: 'item-' + Date.now(),
        branch_id: branchId,
        category_id: item.category_id,
        name: item.name.trim(),
        price: item.price,
        description: item.description?.trim() || null,
        image_url: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        is_available: item.is_available ?? true,
      }
      list.push(saved)
    }

    setStored('kpos_menu_items', list)
    return saved
  },

  toggleMenuItemAvailability(itemId: string, isAvailable: boolean): void {
    const list = getStored<MenuItem[]>('kpos_menu_items', INITIAL_MENU_ITEMS)
    const idx = list.findIndex((i) => i.id === itemId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], is_available: isAvailable }
      setStored('kpos_menu_items', list)
    }
  },

  // Orders
  getOrders(branchId?: string): Order[] {
    const list = getStored<Order[]>('kpos_orders', INITIAL_ORDERS)
    let modified = false
    for (const initOrder of INITIAL_ORDERS) {
      if (!list.some((o) => o.id === initOrder.id)) {
        list.push(initOrder)
        modified = true
      }
    }
    if (modified) {
      setStored('kpos_orders', list)
    }
    if (!branchId) return list
    return list.filter((o) => o.branch_id === branchId || !o.branch_id)
  },

  saveOrder(branchIdOrOrder: string | Order, maybeOrder?: Order): void {
    const order = (typeof branchIdOrOrder === 'string' ? maybeOrder : branchIdOrOrder) as Order
    if (!order) return

    const list = getStored<Order[]>('kpos_orders', INITIAL_ORDERS)
    const idx = list.findIndex((o) => o.id === order.id)
    const prevOrder = idx >= 0 ? list[idx] : null

    if (idx >= 0) {
      list[idx] = order
    } else {
      list.unshift(order)
    }
    setStored('kpos_orders', list)

    // Authoritative Customer Spend updates (Rule 2.4):
    // Only completed orders count towards total_spent and total_orders.
    // If an order transitions to completed: add spend.
    // If an order transitions from completed to cancelled: reverse spend.
    const customerPhone = order.customer_phone?.trim()
    const customerId = order.customer_id
    if (customerId || customerPhone) {
      const customers = Storage.getCustomers(order.branch_id)
      const cust = customerId
        ? customers.find((c) => c.id === customerId)
        : (customerPhone ? customers.find((c) => normalizePhoneNumber(c.phone) === normalizePhoneNumber(customerPhone)) : null)

      if (cust) {
        let deltaOrders = 0
        let deltaSpent = 0

        const wasCompleted = prevOrder?.status === 'completed'
        const isCompleted = order.status === 'completed'

        if (!wasCompleted && isCompleted) {
          deltaOrders = 1
          deltaSpent = order.total
        } else if (wasCompleted && order.status === 'cancelled') {
          deltaOrders = -1
          deltaSpent = -order.total
        }

        if (deltaOrders !== 0 || deltaSpent !== 0) {
          Storage.saveCustomer(order.branch_id, {
            id: cust.id,
            name: cust.name,
            phone: cust.phone,
            total_orders: Math.max(0, (cust.total_orders || 0) + deltaOrders),
            total_spent: Math.max(0, (cust.total_spent || 0) + deltaSpent),
            last_visit_at: isCompleted ? new Date().toISOString() : cust.last_visit_at,
            last_order_at: isCompleted ? new Date().toISOString() : cust.last_order_at,
          })
        }
      }
    }

    // Update deal redemptions count if newly completed and has deal_id
    if (order.deal_id && order.status === 'completed' && prevOrder?.status !== 'completed') {
      const deals = getStored<Deal[]>('kpos_deals', INITIAL_DEALS)
      const dIdx = deals.findIndex((d) => d.id === order.deal_id)
      if (dIdx !== -1) {
        deals[dIdx].times_redeemed = (deals[dIdx].times_redeemed || 0) + 1
        setStored('kpos_deals', deals)
      }
    }
  },

  // Deals & Promotions
  getDeals(branchId?: string): Deal[] {
    const list = getStored<Deal[]>('kpos_deals', INITIAL_DEALS)
    let modified = false
    for (const initDeal of INITIAL_DEALS) {
      if (!list.some((d) => d.id === initDeal.id)) {
        list.push(initDeal)
        modified = true
      }
    }
    if (modified) {
      setStored('kpos_deals', list)
    }
    if (!branchId) return list
    return list.filter((d) => !d.branch_id || d.branch_id === branchId)
  },

  saveDeal(branchId: string, deal: Partial<Deal>): Deal {
    if (!deal.name?.trim()) throw new Error('Deal name is required')
    if (!deal.deal_type) throw new Error('Deal type is required')
    if (deal.discount_value === undefined || deal.discount_value < 0) {
      throw new Error('Valid discount value is required')
    }

    const list = getStored<Deal[]>('kpos_deals', INITIAL_DEALS)
    let saved: Deal

    if (deal.id) {
      const idx = list.findIndex((d) => d.id === deal.id)
      if (idx === -1) throw new Error('Deal not found')
      saved = {
        ...list[idx],
        ...deal,
        name: deal.name.trim(),
        updated_at: new Date().toISOString(),
      } as Deal
      list[idx] = saved
    } else {
      saved = {
        id: 'deal-' + Date.now(),
        branch_id: branchId,
        name: deal.name.trim(),
        description: deal.description?.trim() || null,
        deal_type: deal.deal_type,
        discount_type: deal.discount_type || 'fixed',
        discount_value: deal.discount_value || 0,
        combo_price: deal.combo_price ?? null,
        min_order_amount: deal.min_order_amount ?? 0,
        max_discount_amount: deal.max_discount_amount ?? null,
        applicable_order_types: deal.applicable_order_types || ['dine_in', 'takeaway', 'delivery'],
        applicable_weekdays: deal.applicable_weekdays || [0, 1, 2, 3, 4, 5, 6],
        start_time: deal.start_time || new Date().toISOString(),
        end_time: deal.end_time || null,
        is_active: deal.is_active ?? true,
        is_stackable: deal.is_stackable ?? false,
        redemption_limit: deal.redemption_limit ?? null,
        per_customer_limit: deal.per_customer_limit ?? null,
        times_redeemed: 0,
        internal_notes: deal.internal_notes?.trim() || null,
        items: deal.items || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      list.unshift(saved)
    }

    setStored('kpos_deals', list)
    return saved
  },

  toggleDealActive(dealId: string, isActive: boolean): void {
    const list = getStored<Deal[]>('kpos_deals', INITIAL_DEALS)
    const idx = list.findIndex((d) => d.id === dealId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], is_active: isActive, updated_at: new Date().toISOString() }
      setStored('kpos_deals', list)
    }
  },

  deleteDeal(dealId: string): void {
    const list = getStored<Deal[]>('kpos_deals', INITIAL_DEALS)
    const filtered = list.filter((d) => d.id !== dealId)
    setStored('kpos_deals', filtered)
  },
}
