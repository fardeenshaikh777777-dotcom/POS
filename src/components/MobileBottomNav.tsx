import React, { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

interface MobileBottomNavProps {
  onSignOut?: () => void
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onSignOut }) => {
  const [sheetOpen, setSheetOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const handleNavClick = (path: string) => {
    setSheetOpen(false)
    navigate(path)
  }

  const isCurrentActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const moreModules = [
    { path: '/cash', label: 'Cash Drawer', icon: '💵', desc: 'Till & Sessions' },
    { path: '/tables', label: 'Tables Floor', icon: '🍽️', desc: 'Dine-In Layout' },
    { path: '/menu', label: 'Menu Catalog', icon: '🍲', desc: 'Dishes & Recipes' },
    { path: '/inventory', label: 'Inventory', icon: '📦', desc: 'Stock Ledger' },
    { path: '/purchasing', label: 'Purchasing', icon: '🚚', desc: 'Suppliers & POs' },
    { path: '/expenses', label: 'Expenses', icon: '💸', desc: 'Operational Costs' },
    { path: '/reports', label: 'Financials', icon: '📈', desc: 'P&L and SST' },
    { path: '/customers', label: 'CRM & Loyalty', icon: '👥', desc: 'Customer Profiles' },
    { path: '/staff', label: 'Staff & Shifts', icon: '👔', desc: 'Team Permissions' },
    { path: '/settings', label: 'Settings', icon: '⚙️', desc: 'Branch Config' },
  ]

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Visible exclusively on mobile <860px) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Main Navigation">
        {/* 1. Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `mob-tab-btn ${isActive ? 'active' : ''}`}
          onClick={() => setSheetOpen(false)}
        >
          <span className="mob-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          </span>
          <span className="mob-tab-label">Analyze</span>
        </NavLink>

        {/* 2. POS Register (Highlighted primary action) */}
        <NavLink
          to="/pos"
          className={({ isActive }) => `mob-tab-btn mob-tab-btn--pos ${isActive ? 'active' : ''}`}
          onClick={() => setSheetOpen(false)}
        >
          <div className="mob-pos-pill">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="mob-tab-label">POS</span>
        </NavLink>

        {/* 3. Orders */}
        <NavLink
          to="/orders"
          className={({ isActive }) => `mob-tab-btn ${isActive ? 'active' : ''}`}
          onClick={() => setSheetOpen(false)}
        >
          <span className="mob-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </span>
          <span className="mob-tab-label">Orders</span>
        </NavLink>

        {/* 4. Kitchen KDS */}
        <NavLink
          to="/kitchen"
          className={({ isActive }) => `mob-tab-btn ${isActive ? 'active' : ''}`}
          onClick={() => setSheetOpen(false)}
        >
          <span className="mob-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </span>
          <span className="mob-tab-label">Kitchen</span>
        </NavLink>

        {/* 5. More Actions Drawer */}
        <button
          type="button"
          className={`mob-tab-btn ${sheetOpen ? 'active' : ''}`}
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-label="Open complete restaurant modules menu"
        >
          <span className="mob-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </span>
          <span className="mob-tab-label">Modules</span>
        </button>
      </nav>

      {/* Slide-Up Bottom Sheet Modal for Full Restaurant Control */}
      {sheetOpen && (
        <div className="mob-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div
            className="mob-sheet-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Restaurant Management Modules"
          >
            {/* Sheet Handle */}
            <div className="mob-sheet-drag-handle" />

            {/* Sheet Header */}
            <div className="mob-sheet-head">
              <div>
                <h3 className="mob-sheet-title">Management Hub</h3>
                <p className="mob-sheet-sub">
                  Clifton Branch · Role: <strong>{profile?.role?.toUpperCase() || 'OWNER'}</strong>
                </p>
              </div>
              <button
                type="button"
                className="mob-sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Grid of Modules */}
            <div className="mob-modules-grid">
              {moreModules.map((item) => {
                const active = isCurrentActive(item.path)
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`mob-mod-card ${active ? 'mob-mod-card--active' : ''}`}
                    onClick={() => handleNavClick(item.path)}
                  >
                    <span className="mob-mod-icon">{item.icon}</span>
                    <div className="mob-mod-texts">
                      <span className="mob-mod-label">{item.label}</span>
                      <span className="mob-mod-desc">{item.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Sheet Footer with Sign Out */}
            {onSignOut && (
              <div className="mob-sheet-foot">
                <button
                  type="button"
                  className="mob-sheet-signout"
                  onClick={() => {
                    setSheetOpen(false)
                    onSignOut()
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign out of Karachi Express</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
