import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Badge, Button } from '@/components/ui'
import { modulesFor, MODULES, type ModuleKey } from '@/lib/modules'
import type { AppRole } from '@/types/domain'

function ModuleIcon({ moduleKey }: { moduleKey: ModuleKey }) {
  switch (moduleKey) {
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'pos':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )
    case 'orders':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      )
    case 'kitchen':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    case 'menu':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      )
    case 'tables':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="12" rx="2" />
          <path d="M4 16v4" />
          <path d="M20 16v4" />
          <path d="M12 4v12" />
        </svg>
      )
    case 'inventory':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      )
    case 'purchasing':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'cash':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      )
    case 'expenses':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="m17 5-5-3-5 3" />
          <path d="m17 19-5 3-5-3" />
          <path d="M2 12h20" />
        </svg>
      )
    case 'reports':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" x2="18" y1="20" y2="10" />
          <line x1="12" x2="12" y1="20" y2="4" />
          <line x1="6" x2="6" y1="20" y2="14" />
        </svg>
      )
    case 'customers':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'staff':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'settings':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

export function AppShell() {
  const { profile, signOut, switchDemoRole } = useAuth()
  const location = useLocation()
  const nav = modulesFor(profile?.role)
  const [searchQuery, setSearchQuery] = useState('')
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard'

  const [karachiTime, setKarachiTime] = useState(() =>
    new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date())
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setKarachiTime(
        new Intl.DateTimeFormat('en-PK', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date())
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Current page module information
  const currentModule = MODULES.find((m) => m.path === location.pathname) || {
    label: 'Overview',
    description: 'Manage your restaurant & team members from here.',
  }

  // Initials for account badge (NO IMAGES used as requested)
  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'KE'

  return (
    <div className="shell">
      {/* Restored 240px Navigation Sidebar */}
      <aside className="sidebar" aria-label="Main Navigation">
        {/* Brand: Clean Typography + Amber Dot (No Logo) */}
        <div className="brand">
          <div>
            <div className="brand__title">
              <span className="brand__dot" />
              Karachi Express
            </div>
            <div className="brand__sub">Clifton Branch · v2.0</div>
          </div>
          <div className="mobile-header-actions">
            <div className="mobile-role-selector">
              <select
                value={profile?.role || 'owner'}
                onChange={(e) => switchDemoRole(e.target.value as AppRole)}
                className="input"
                aria-label="Switch demo role on mobile"
                style={{ padding: '2px 8px', fontSize: '11px', height: '28px', minHeight: '28px' }}
              >
                <option value="owner">👑 Owner</option>
                <option value="manager">💼 Manager</option>
                <option value="cashier">💵 Cashier</option>
                <option value="kitchen">🍳 Kitchen</option>
                <option value="waiter">🍽️ Waiter</option>
              </select>
            </div>
            <button
              type="button"
              className="mobile-signout-btn"
              onClick={signOut}
              title="Sign out of Karachi Express"
              aria-label="Sign out"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Navigation list with both icons and labels */}
        <nav className="nav" aria-label="Modules">
          {nav.map((m) => (
            <NavLink
              key={m.key}
              to={m.path}
              end={m.path === '/'}
              className={({ isActive }) => `nav__link ${isActive ? 'active' : ''}`}
            >
              <span className="nav__icon">
                <ModuleIcon moduleKey={m.key} />
              </span>
              <span className="nav__label">{m.label}</span>
            </NavLink>
          ))}
          {/* Mobile-only nav Sign out button */}
          <button
            type="button"
            className="mobile-nav-signout"
            onClick={signOut}
            title="Sign out of Karachi Express"
            aria-label="Sign out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>
        </nav>

        {/* Restored Sidebar Footer: User, Role Switcher, Sign out */}
        <div className="sidebar__foot">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
              {profile?.full_name?.split(' ')[0] || 'Owner'}
            </span>
            <Badge tone="accent">{profile?.role?.toUpperCase() || 'OWNER'}</Badge>
          </div>

          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Fast Switch Role:
            </label>
            <select
              value={profile?.role || 'owner'}
              onChange={(e) => switchDemoRole(e.target.value as AppRole)}
              className="input"
              style={{
                width: '100%',
                minHeight: '32px',
                padding: '2px 6px',
                fontSize: '11px',
                marginTop: '2px',
              }}
            >
              <option value="owner">👑 Owner (Full Access)</option>
              <option value="manager">💼 Branch Manager</option>
              <option value="cashier">💵 Cashier (Till & POS)</option>
              <option value="kitchen">🍳 Kitchen Chef (KDS)</option>
              <option value="waiter">🍽️ Floor Waiter</option>
            </select>
          </div>

          <div style={{ marginTop: '10px' }}>
            <Button size="sm" variant="ghost" style={{ width: '100%' }} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {/* Top Header */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">
              {currentModule.label === 'Dashboard' ? 'Operations Overview' : currentModule.label}
            </h1>
            <p className="topbar-sub">{currentModule.description}</p>
          </div>

          <div className="topbar-right">
            {/* Live Karachi Real-Time Clock on Dashboard, Global Search on other views */}
            {isDashboard ? (
              <div className="karachi-live-clock" title="Karachi Live Restaurant Time (Asia/Karachi)">
                <span className="live-indicator-dot" />
                <span className="clock-city">KARACHI TIME</span>
                <span className="clock-time">{karachiTime}</span>
                <span className="clock-sub">PKT (UTC+5)</span>
              </div>
            ) : (
              <div className="search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-400)" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Search anything..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search"
                />
                <span className="search-shortcut">⌘F</span>
              </div>
            )}

            {/* Account Monogram / Initials (No Photo Image) + Topbar Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="account-chip">
                <div className="account-avatar" aria-hidden="true">
                  {initials}
                </div>
                <div className="account-details">
                  <span className="account-name">{profile?.full_name || 'System Owner'}</span>
                  <span className="account-role">{profile?.role?.toUpperCase() || 'OWNER'}</span>
                </div>
              </div>
              <button
                type="button"
                className="topbar-signout-btn"
                onClick={signOut}
                title="Sign out of Karachi Express"
                aria-label="Sign out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="topbar-signout-text">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
