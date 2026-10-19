import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchInventoryItems,
  fetchStockMovements,
  adjustStockRpc,
  restockInventoryItem,
  fetchRecipeItems,
  saveRecipeItem,
} from './api'
import { fetchAllMenuItems } from '@/features/menu/api'
import type { InventoryItem, StockMovement, RecipeItem, MenuItem, StockReason } from '@/types/domain'

export function InventoryPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [activeTab, setActiveTab] = useState<'stock' | 'recipes' | 'ledger'>('stock')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [recipes, setRecipes] = useState<RecipeItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Restock Inventory Modal
  const [restockModalOpen, setRestockModalOpen] = useState(false)
  const [restockItemId, setRestockItemId] = useState('')
  const [restockQty, setRestockQty] = useState<number>(10)
  const [restockCost, setRestockCost] = useState<number>(0)
  const [restockSupplier, setRestockSupplier] = useState('')
  const [restockNote, setRestockNote] = useState('')
  const [restocking, setRestocking] = useState(false)

  // Adjust Stock Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [adjustDelta, setAdjustDelta] = useState<number>(0)
  const [adjustReason, setAdjustReason] = useState<StockReason>('adjustment')
  const [adjustNote, setAdjustNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Add Recipe Modal
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [recipeMenuItemId, setRecipeMenuItemId] = useState('')
  const [recipeInvItemId, setRecipeInvItemId] = useState('')
  const [recipeQty, setRecipeQty] = useState(0.25)
  const [recipeUnit, setRecipeUnit] = useState('kg')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [inv, mvm, rcp, mnu] = await Promise.all([
        fetchInventoryItems(branchId),
        fetchStockMovements(branchId),
        fetchRecipeItems(branchId),
        fetchAllMenuItems(branchId),
      ])
      setItems(inv)
      setMovements(mvm)
      setRecipes(rcp)
      setMenuItems(mnu)
      if (inv.length > 0) {
        setSelectedItemId((prev) => prev || inv[0].id)
        setRecipeInvItemId((prev) => prev || inv[0].id)
      }
      if (mnu.length > 0) {
        setRecipeMenuItemId((prev) => prev || mnu[0].id)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRestock = async () => {
    if (!restockItemId || restockQty <= 0) return
    setRestocking(true)
    try {
      await restockInventoryItem(
        branchId,
        restockItemId,
        restockQty,
        restockCost || undefined,
        restockSupplier || undefined,
        restockNote || undefined
      )
      setRestockModalOpen(false)
      setRestockQty(10)
      setRestockCost(0)
      setRestockSupplier('')
      setRestockNote('')
      await loadData()
    } catch (err) {
      alert(`Restock error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRestocking(false)
    }
  }

  const handleAdjustStock = async () => {
    if (!selectedItemId || adjustDelta === 0) return
    setSubmitting(true)
    try {
      await adjustStockRpc(branchId, selectedItemId, adjustDelta, adjustReason, adjustNote)
      setAdjustModalOpen(false)
      setAdjustDelta(0)
      setAdjustNote('')
      await loadData()
    } catch (err) {
      alert(`Stock adjustment error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveRecipe = async () => {
    if (!recipeMenuItemId || !recipeInvItemId || recipeQty <= 0) return
    try {
      await saveRecipeItem(branchId, recipeMenuItemId, recipeInvItemId, recipeQty, recipeUnit)
      setRecipeModalOpen(false)
      await loadData()
    } catch (err) {
      alert(`Save recipe error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const stockColumns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Ingredient / Raw Material',
      render: (r) => <strong>{r.name}</strong>,
    },
    {
      key: 'current_qty',
      header: 'Current Stock',
      numeric: true,
      render: (r) => (
        <span className="num" style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>
          {r.current_qty} {r.unit}
        </span>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Level',
      numeric: true,
      render: (r) => <span className="muted">{r.reorder_level} {r.unit}</span>,
    },
    {
      key: 'status',
      header: 'Stock Status',
      render: (r) => {
        const isLow = r.current_qty <= r.reorder_level
        return (
          <Badge tone={isLow ? 'danger' : 'ok'}>
            {isLow ? 'LOW STOCK - REORDER' : 'IN STOCK'}
          </Badge>
        )
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setRestockItemId(r.id)
              setRestockModalOpen(true)
            }}
          >
            📥 Restock
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedItemId(r.id)
              setAdjustModalOpen(true)
            }}
          >
            ⚖️ Adjust
          </Button>
        </div>
      ),
    },
  ]

  const ledgerColumns: Column<StockMovement>[] = [
    {
      key: 'time',
      header: 'Timestamp',
      render: (r) => (
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {new Date(r.created_at).toLocaleString('en-GB')}
        </span>
      ),
    },
    {
      key: 'item',
      header: 'Ingredient',
      render: (r) => <strong>{r.inventory_item?.name || 'Item'}</strong>,
    },
    {
      key: 'delta',
      header: 'Stock Change',
      numeric: true,
      render: (r) => (
        <strong style={{ color: r.delta > 0 ? 'var(--ok)' : 'var(--danger)' }} className="num">
          {r.delta > 0 ? `+${r.delta}` : r.delta}
        </strong>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => <Badge tone="neutral">{r.reason.toUpperCase()}</Badge>,
    },
    {
      key: 'note',
      header: 'Audit Note',
      render: (r) => <span style={{ fontSize: 'var(--fs-xs)' }}>{r.note || '—'}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Inventory & Recipe Consumption"
        subtitle="Real-time ingredient levels, dish recipe deductions, and append-only stock audit ledger"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="primary"
              onClick={() => {
                if (items.length > 0 && !restockItemId) setRestockItemId(items[0].id)
                setRestockModalOpen(true)
              }}
            >
              📥 Restock Inventory
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRecipeModalOpen(true)}
            >
              + Link Recipe Item
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (items.length > 0) setSelectedItemId(items[0].id)
                setAdjustModalOpen(true)
              }}
            >
              ⚖️ Log Stock Adjustment
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn ${activeTab === 'stock' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 Ingredient Stock Levels ({items.length})
        </button>
        <button
          className={`btn ${activeTab === 'recipes' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('recipes')}
        >
          🍲 Product Recipes ({recipes.length})
        </button>
        <button
          className={`btn ${activeTab === 'ledger' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('ledger')}
        >
          📜 Stock Ledger & Audit Log ({movements.length})
        </button>
      </div>

      {loading && <LoadingState label="Loading stock ledgers and recipe matrix…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && activeTab === 'stock' && (
        <Card title="Current Ingredients Inventory">
          <DataTable columns={stockColumns} rows={items} rowKey={(r) => r.id} />
        </Card>
      )}

      {!loading && !error && activeTab === 'recipes' && (
        <Card title="Configured Dish Recipes">
          {recipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p className="muted">No recipes currently linked. Click '+ Link Recipe Item' above to map a menu item to raw ingredients.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipes.map((rcp) => {
                const menuItem = menuItems.find((m) => m.id === rcp.menu_item_id)
                return (
                  <div key={rcp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div>
                      <strong>{menuItem?.name || 'Dish'}</strong>
                      <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                        Deducts: {rcp.inventory_item?.name || 'Ingredient'}
                      </span>
                    </div>
                    <div>
                      <Badge tone="accent">
                        {rcp.quantity} {rcp.unit} per order
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {!loading && !error && activeTab === 'ledger' && (
        <Card title="Append-Only Stock Ledger">
          <DataTable columns={ledgerColumns} rows={movements} rowKey={(r) => r.id} />
        </Card>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Log Stock Adjustment</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Modifications are recorded to the immutable ledger and cannot cause stock to drop below zero.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="field__label">Ingredient</label>
                <select
                  className="input"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.current_qty} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field__label">Reason</label>
                <select
                  className="input"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockReason)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="waste">Kitchen Spoilage / Waste</option>
                  <option value="adjustment">Physical Count Audit Adjustment</option>
                  <option value="purchase">Direct Local Purchase</option>
                  <option value="return">Customer Return / Void Reversal</option>
                  <option value="opening">Opening Stock Setup</option>
                </select>
              </div>

              <Field
                id="delta"
                label="Adjustment Quantity (+ to add, - to subtract)"
                type="number"
                step="0.1"
                placeholder="e.g. -2.5 or +10"
                value={adjustDelta || ''}
                onChange={(e) => setAdjustDelta(parseFloat(e.target.value) || 0)}
              />

              <Field
                id="note"
                label="Audit Reason Note"
                placeholder="e.g. Broken packaging or end-of-day audit"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setAdjustModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={submitting} onClick={handleAdjustStock} disabled={adjustDelta === 0}>
                  Confirm Ledger Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Item Modal */}
      {recipeModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Link Dish to Raw Ingredient</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Select Menu Dish</label>
                <select
                  className="input"
                  value={recipeMenuItemId}
                  onChange={(e) => setRecipeMenuItemId(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field__label">Ingredient to Deduct</label>
                <select
                  className="input"
                  value={recipeInvItemId}
                  onChange={(e) => {
                    setRecipeInvItemId(e.target.value)
                    const found = items.find((i) => i.id === e.target.value)
                    if (found) setRecipeUnit(found.unit)
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>

              <Field
                id="rqty"
                label="Consumption Quantity per Portion"
                type="number"
                step="0.01"
                value={recipeQty}
                onChange={(e) => setRecipeQty(parseFloat(e.target.value) || 0)}
              />

              <Field
                id="runit"
                label="Unit of Measure"
                value={recipeUnit}
                onChange={(e) => setRecipeUnit(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setRecipeModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveRecipe}>
                  Save Recipe Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restock Inventory Modal */}
      {restockModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>📥 Receive Inventory Restock</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Add incoming stock to current inventory. Entries are verified and permanently appended to the audit ledger.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="field__label">Ingredient / Raw Material</label>
                <select
                  className="input"
                  value={restockItemId}
                  onChange={(e) => setRestockItemId(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.current_qty} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const cur = items.find((i) => i.id === restockItemId) || items[0]
                return (
                  <div style={{ background: 'var(--surface-muted)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Current Stock Level:</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <strong>{cur?.name}</strong>
                      <Badge tone={cur?.current_qty <= cur?.reorder_level ? 'danger' : 'ok'}>
                        {cur?.current_qty} {cur?.unit} in stock
                      </Badge>
                    </div>
                  </div>
                )
              })()}

              <Field
                id="restock-qty"
                label="Restock Quantity (+ to add)"
                type="number"
                step="0.5"
                min="0.1"
                placeholder="e.g. 25"
                value={restockQty || ''}
                onChange={(e) => setRestockQty(Math.max(0, parseFloat(e.target.value) || 0))}
              />

              <Field
                id="restock-cost"
                label="Total Purchase Cost in PKR (Optional)"
                type="number"
                placeholder="e.g. 8500"
                value={restockCost || ''}
                onChange={(e) => setRestockCost(Math.max(0, parseFloat(e.target.value) || 0))}
              />

              <Field
                id="restock-supplier"
                label="Vendor / Supplier Name (Optional)"
                placeholder="e.g. Al-Madina Rice Traders or Clifton Meat Market"
                value={restockSupplier}
                onChange={(e) => setRestockSupplier(e.target.value)}
              />

              <Field
                id="restock-note"
                label="Invoice / Purchase Note (Optional)"
                placeholder="e.g. Fresh morning delivery, Batch #409"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setRestockModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={restocking}
                  onClick={handleRestock}
                  disabled={restockQty <= 0 || !restockItemId}
                >
                  Confirm & Receive Restock
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
