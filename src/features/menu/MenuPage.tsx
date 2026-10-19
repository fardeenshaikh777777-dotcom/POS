import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchAllCategories,
  fetchAllMenuItems,
  toggleMenuItemAvailability,
  saveMenuItem,
  createMenuCategory,
} from './api'
import type { MenuCategory, MenuItem } from '@/types/domain'

export function MenuPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cats, mItems] = await Promise.all([
        fetchAllCategories(branchId),
        fetchAllMenuItems(branchId),
      ])
      setCategories(cats)
      setItems(mItems)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleAvailable = async (item: MenuItem) => {
    try {
      await toggleMenuItemAvailability(item.id, !item.is_available)
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      )
    } catch (err) {
      alert(`Error toggling: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSaveItem = async () => {
    if (!editingItem || !editingItem.name?.trim() || !editingItem.category_id || typeof editingItem.price !== 'number' || editingItem.price < 0) {
      alert('Please fill all required dish details with valid positive price')
      return
    }
    setSubmitting(true)
    try {
      const saved = await saveMenuItem(branchId, editingItem)
      setItemModalOpen(false)
      setEditingItem(null)
      setSuccessMsg(`Dish "${saved.name}" saved successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Error saving item: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return
    setSubmitting(true)
    try {
      const saved = await createMenuCategory(branchId, newCatName.trim())
      setCatModalOpen(false)
      setNewCatName('')
      setSuccessMsg(`Category "${saved.name}" created successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Error creating category: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredItems = items.filter(
    (i) => selectedCat === 'all' || i.category_id === selectedCat
  )

  const columns: Column<MenuItem>[] = [
    {
      key: 'name',
      header: 'Dish Name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {r.image_url ? (
            <img
              src={r.image_url}
              alt={r.name}
              loading="lazy"
              decoding="async"
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => {
                // hide broken img and show generic icon
                ;(e.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              🍲
            </div>
          )}
          <div>
            <strong>{r.name}</strong>
            {r.description && <p className="muted" style={{ fontSize: 'var(--fs-xs)', margin: '2px 0 0 0' }}>{r.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => {
        const cat = categories.find((c) => c.id === r.category_id)
        return <Badge tone="neutral">{cat?.name || 'Unassigned'}</Badge>
      },
    },
    {
      key: 'price',
      header: 'Price (PKR)',
      numeric: true,
      render: (r) => <strong>{formatPKR(r.price)}</strong>,
    },
    {
      key: 'availability',
      header: 'Kitchen Availability',
      render: (r) => (
        <button
          className={`btn btn--sm ${r.is_available ? 'btn--ghost' : 'btn--danger'}`}
          onClick={() => handleToggleAvailable(r)}
        >
          {r.is_available ? '✅ Available' : '🚫 86\'d (Unavailable)'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditingItem(r)
            setItemModalOpen(true)
          }}
        >
          ✏️ Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Menu & Pricing"
        subtitle="Manage categories, dishes, prices, and kitchen availability"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              onClick={() => setCatModalOpen(true)}
            >
              + Add Category
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingItem({
                  branch_id: branchId,
                  category_id: categories[0]?.id || '',
                  name: '',
                  description: '',
                  price: 0,
                  image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
                  is_available: true,
                })
                setItemModalOpen(true)
              }}
            >
              + Add New Dish
            </Button>
          </div>
        }
      />

      {successMsg && (
        <div style={{ background: 'var(--ok-bg, #dcefe4)', color: 'var(--ok, #2f7d57)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      <Card>
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', marginBottom: '16px', paddingBottom: '2px' }}>
          <button
            className={`btn btn--sm ${selectedCat === 'all' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => setSelectedCat('all')}
          >
            All Dishes ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`btn btn--sm ${selectedCat === c.id ? 'btn--primary' : 'btn--ghost'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setSelectedCat(c.id)}
            >
              {c.name} ({items.filter((i) => i.category_id === c.id).length})
            </button>
          ))}
        </div>

        {loading && <LoadingState label="Loading menu items from database…" />}
        {error && <ErrorState error={error} onRetry={loadData} />}
        {!loading && !error && (
          <DataTable columns={columns} rows={filteredItems} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Add / Edit Dish Modal */}
      {itemModalOpen && editingItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>{editingItem.id ? 'Edit Dish' : 'Add New Menu Item'}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Category *</label>
                <select
                  className="input"
                  value={editingItem.category_id}
                  onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <Field
                id="dish-name"
                label="Dish Name *"
                value={editingItem.name || ''}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                placeholder="e.g. Chicken Malai Boti Plate"
              />

              <Field
                id="dish-price"
                label="Price in PKR *"
                type="number"
                min="0"
                value={editingItem.price ?? ''}
                onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 520"
              />

              <Field
                id="dish-image"
                label="Image URL (Optional)"
                value={editingItem.image_url || ''}
                onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                placeholder="https://..."
              />

              <Field
                id="dish-desc"
                label="Description & Recipe Notes"
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                placeholder="e.g. Boneless chicken marinated in cream, green chillies, and mild herbs."
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setItemModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={handleSaveItem}
                  disabled={!editingItem.name?.trim() || !editingItem.category_id}
                >
                  Save Dish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {catModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Add Menu Category</h2>
            <div style={{ marginTop: '16px' }}>
              <Field
                id="cat-name"
                label="Category Name *"
                placeholder="e.g. Traditional Soups & Starters"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setCatModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={handleSaveCategory}
                  disabled={!newCatName.trim()}
                >
                  Create Category
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
