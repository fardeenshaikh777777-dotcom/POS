import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { InventoryItem, StockMovement, RecipeItem, StockReason } from '@/types/domain'

export async function fetchInventoryItems(branchId: string): Promise<InventoryItem[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (!error && data && data.length > 0) return data as InventoryItem[]
  }

  return Storage.getInventory(branchId)
}

export async function adjustStockRpc(
  branchId: string,
  inventoryItemId: string,
  delta: number,
  reason: StockReason,
  note?: string
): Promise<{ id: string; new_qty: number }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_branch_id: branchId,
      p_inventory_item_id: inventoryItemId,
      p_delta: delta,
      p_reason: reason,
      p_note: note || null,
    })
    if (error) throw error
    try {
      Storage.adjustStock(branchId, inventoryItemId, delta, reason, note)
    } catch {
      // local sync
    }
    return data
  }

  const res = Storage.adjustStock(branchId, inventoryItemId, delta, reason, note)
  return { id: res.movement.id, new_qty: res.item.current_qty }
}

export async function restockInventoryItem(
  branchId: string,
  inventoryItemId: string,
  quantity: number,
  cost?: number,
  supplier?: string,
  note?: string
): Promise<{ id: string; new_qty: number }> {
  if (quantity <= 0) throw new Error('Restock quantity must be positive and greater than zero')

  const auditNote = [
    `Restocked +${quantity}`,
    cost ? `Cost: PKR ${cost}` : null,
    supplier ? `Supplier: ${supplier}` : null,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(' | ')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_branch_id: branchId,
      p_inventory_item_id: inventoryItemId,
      p_delta: quantity,
      p_reason: 'purchase',
      p_note: auditNote,
    })
    if (error) throw error
    try {
      Storage.restockItem(branchId, inventoryItemId, quantity, cost, supplier, note)
    } catch {
      // local sync
    }
    return data
  }

  const res = Storage.restockItem(branchId, inventoryItemId, quantity, cost, supplier, note)
  return { id: res.movement.id, new_qty: res.item.current_qty }
}

export async function fetchStockMovements(branchId: string): Promise<StockMovement[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, inventory_item:inventory_items(*)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data && data.length > 0) return data as StockMovement[]
  }

  return Storage.getStockMovements(branchId)
}

export async function fetchRecipeItems(branchId: string): Promise<RecipeItem[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('recipe_items')
      .select('*, inventory_item:inventory_items(*)')
      .eq('branch_id', branchId)
    if (!error && data) return data as RecipeItem[]
  }

  return Storage.getRecipes(branchId)
}

export async function saveRecipeItem(
  branchId: string,
  menuItemId: string,
  inventoryItemId: string,
  quantity: number,
  unit: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('recipe_items').upsert(
      {
        branch_id: branchId,
        menu_item_id: menuItemId,
        inventory_item_id: inventoryItemId,
        quantity,
        unit,
      },
      { onConflict: 'menu_item_id,inventory_item_id' }
    )
    if (error) throw error
    try {
      Storage.saveRecipeItem(branchId, menuItemId, inventoryItemId, quantity, unit)
    } catch {
      // local sync
    }
    return
  }

  Storage.saveRecipeItem(branchId, menuItemId, inventoryItemId, quantity, unit)
}
