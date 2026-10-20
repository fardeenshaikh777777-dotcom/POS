import type { AppRole } from '@/types/domain'

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'kitchen'
  | 'menu'
  | 'deals'
  | 'tables'
  | 'inventory'
  | 'purchasing'
  | 'cash'
  | 'expenses'
  | 'reports'
  | 'customers'
  | 'staff'
  | 'settings'

export interface ModuleDef {
  key: ModuleKey
  path: string
  label: string
  description: string
  roles: readonly AppRole[]
}

/** Single source of truth for navigation, routing and UI-level permission checks.
 *  UI checks are convenience only; RLS/RPCs enforce real database authorization. */
export const MODULES: readonly ModuleDef[] = [
  { key: 'dashboard', path: '/', label: 'Dashboard', description: 'Real-time sales, order stats, and live metrics', roles: ['owner', 'manager'] },
  { key: 'pos', path: '/pos', label: 'POS & Billing', description: 'Counter, dine-in and delivery order creation', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { key: 'orders', path: '/orders', label: 'Orders', description: 'Live order tracking, receipts, and rider management', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { key: 'kitchen', path: '/kitchen', label: 'Kitchen KDS', description: 'Real-time order tickets for kitchen display', roles: ['owner', 'manager', 'kitchen'] },
  { key: 'menu', path: '/menu', label: 'Menu & Prices', description: 'Categories, dishes, availability, and pricing', roles: ['owner', 'manager'] },
  { key: 'deals', path: '/deals', label: 'Deals & Promos', description: 'Combos, discounts, BOGO offers, and promotion rules', roles: ['owner', 'manager', 'cashier'] },
  { key: 'tables', path: '/tables', label: 'Tables & Booking', description: 'Dining floor layout, occupancy, and reservations', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { key: 'inventory', path: '/inventory', label: 'Inventory & Recipes', description: 'Ingredients, stock adjustments, and dish recipes', roles: ['owner', 'manager', 'kitchen'] },
  { key: 'purchasing', path: '/purchasing', label: 'Purchasing', description: 'Suppliers, purchase orders, and stock receipts', roles: ['owner', 'manager'] },
  { key: 'cash', path: '/cash', label: 'Cash Drawer', description: 'Shift float, cash balancing, and reconciliation', roles: ['owner', 'manager', 'cashier'] },
  { key: 'expenses', path: '/expenses', label: 'Expenses', description: 'Operational costs, vendor payouts, and petty cash', roles: ['owner', 'manager', 'cashier'] },
  { key: 'reports', path: '/reports', label: 'Reports', description: 'Financial summaries, item performance, and sales mix', roles: ['owner', 'manager'] },
  { key: 'customers', path: '/customers', label: 'Customers', description: 'Customer directory, order histories, and phone lookups', roles: ['owner', 'manager', 'cashier'] },
  { key: 'staff', path: '/staff', label: 'Staff & PINs', description: 'Team access, role assignments, and security PINs', roles: ['owner', 'manager'] },
  { key: 'settings', path: '/settings', label: 'Settings', description: 'Branch info, tax rates, receipt headers, and demo seed', roles: ['owner', 'manager'] },
]

export function canAccess(role: AppRole | null | undefined, module: ModuleDef): boolean {
  return !!role && module.roles.includes(role)
}

export function modulesFor(role: AppRole | null | undefined): ModuleDef[] {
  return MODULES.filter((m) => canAccess(role, m))
}

export function defaultPathFor(role: AppRole | null | undefined): string {
  return modulesFor(role)[0]?.path ?? '/login'
}
