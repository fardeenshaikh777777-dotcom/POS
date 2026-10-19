import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { MenuCategory, MenuItem } from '@/types/domain'

export async function fetchAllCategories(branchId: string): Promise<MenuCategory[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) return data as MenuCategory[]
  }
  return Storage.getCategories(branchId)
}

export async function fetchAllMenuItems(branchId: string): Promise<MenuItem[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true })
    if (!error && data && data.length > 0) return data as MenuItem[]
  }
  return Storage.getMenuItems(branchId)
}

export async function toggleMenuItemAvailability(itemId: string, isAvailable: boolean): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
      .eq('id', itemId)
    if (error) throw error
  }
  Storage.toggleMenuItemAvailability(itemId, isAvailable)
}

export async function saveMenuItem(branchId: string, item: Partial<MenuItem>): Promise<MenuItem> {
  if (!item.name?.trim()) throw new Error('Dish name is required')
  if (!item.category_id) throw new Error('Category is required')
  if (typeof item.price !== 'number' || item.price < 0) throw new Error('Price must be greater than or equal to 0')

  if (isSupabaseConfigured) {
    if (item.id) {
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          name: item.name.trim(),
          category_id: item.category_id,
          price: item.price,
          description: item.description?.trim() || null,
          is_available: item.is_available ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .select()
        .single()
      if (error) throw error
      try {
        Storage.saveMenuItem(branchId, item)
      } catch {
        // local sync
      }
      return data as MenuItem
    } else {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          branch_id: branchId,
          category_id: item.category_id,
          name: item.name.trim(),
          price: item.price,
          description: item.description?.trim() || null,
          is_available: item.is_available ?? true,
        })
        .select()
        .single()
      if (error) throw error
      try {
        Storage.saveMenuItem(branchId, item)
      } catch {
        // local sync
      }
      return data as MenuItem
    }
  }

  return Storage.saveMenuItem(branchId, item)
}

export async function createMenuCategory(branchId: string, name: string, sortOrder = 0): Promise<MenuCategory> {
  if (!name.trim()) throw new Error('Category name is required')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        branch_id: branchId,
        name: name.trim(),
        sort_order: sortOrder,
      })
      .select()
      .single()
    if (error) throw error
    try {
      Storage.saveCategory(branchId, name, sortOrder)
    } catch {
      // local sync
    }
    return data as MenuCategory
  }

  return Storage.saveCategory(branchId, name, sortOrder)
}
