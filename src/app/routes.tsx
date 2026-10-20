import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoadingState } from '@/components/ui'
import { MODULES, canAccess, defaultPathFor, type ModuleDef } from '@/lib/modules'

// Code-split feature module pages for fast initial load & responsiveness
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PosPage = lazy(() => import('@/features/pos/PosPage').then((m) => ({ default: m.PosPage })))
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const KitchenPage = lazy(() => import('@/features/kitchen/KitchenPage').then((m) => ({ default: m.KitchenPage })))
const MenuPage = lazy(() => import('@/features/menu/MenuPage').then((m) => ({ default: m.MenuPage })))
const DealsPage = lazy(() => import('@/features/deals/DealsPage').then((m) => ({ default: m.DealsPage })))
const TablesPage = lazy(() => import('@/features/tables/TablesPage').then((m) => ({ default: m.TablesPage })))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const PurchasingPage = lazy(() => import('@/features/purchasing/PurchasingPage').then((m) => ({ default: m.PurchasingPage })))
const CashPage = lazy(() => import('@/features/cash/CashPage').then((m) => ({ default: m.CashPage })))
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const StaffPage = lazy(() => import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()
  if (loading) return <LoadingState label="Starting Karachi Express POS…" />
  if (!profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleGate({ module, children }: { module: ModuleDef; children: React.ReactNode }) {
  const { profile } = useAuth()
  if (!canAccess(profile?.role, module)) {
    return <Navigate to={defaultPathFor(profile?.role)} replace />
  }
  return <Suspense fallback={<LoadingState label={`Loading ${module.label}…`} />}>{children}</Suspense>
}

function getModuleComponent(key: string) {
  switch (key) {
    case 'dashboard':
      return <DashboardPage />
    case 'pos':
      return <PosPage />
    case 'orders':
      return <OrdersPage />
    case 'kitchen':
      return <KitchenPage />
    case 'menu':
      return <MenuPage />
    case 'deals':
      return <DealsPage />
    case 'tables':
      return <TablesPage />
    case 'inventory':
      return <InventoryPage />
    case 'purchasing':
      return <PurchasingPage />
    case 'cash':
      return <CashPage />
    case 'expenses':
      return <ExpensesPage />
    case 'reports':
      return <ReportsPage />
    case 'customers':
      return <CustomersPage />
    case 'staff':
      return <StaffPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <DashboardPage />
  }
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        {MODULES.map((m) => (
          <Route
            key={m.key}
            path={m.path}
            element={
              <RoleGate module={m}>
                {getModuleComponent(m.key)}
              </RoleGate>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
