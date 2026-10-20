import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Deal, MenuItem } from '@/types/domain'

export async function fetchDealsList(branchId: string): Promise<Deal[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('deals')
      .select('*, items:deal_items(*, menu_item:menu_items(*))')
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order('created_at', { ascending: false })
    if (!error && data && data.length > 0) return data as Deal[]
  }

  return Storage.getDeals(branchId)
}

export async function fetchActiveDeals(branchId: string): Promise<Deal[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('deals')
      .select('*, items:deal_items(*, menu_item:menu_items(*))')
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (!error && data && data.length > 0) return data as Deal[]
  }

  return Storage.getDeals(branchId).filter((d) => d.is_active)
}

export async function saveDealRecord(branchId: string, deal: Partial<Deal>): Promise<Deal> {
  if (!deal.name?.trim()) throw new Error('Deal name is required')
  if (!deal.deal_type) throw new Error('Deal type is required')

  if (isSupabaseConfigured) {
    const dealPayload = {
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
      internal_notes: deal.internal_notes?.trim() || null,
    }

    if (deal.id) {
      const { data, error } = await supabase
        .from('deals')
        .update(dealPayload)
        .eq('id', deal.id)
        .select()
        .single()
      if (error) throw error

      if (deal.items) {
        await supabase.from('deal_items').delete().eq('deal_id', deal.id)
        if (deal.items.length > 0) {
          await supabase.from('deal_items').insert(
            deal.items.map((it) => ({
              deal_id: deal.id,
              menu_item_id: it.menu_item_id || null,
              category_id: it.category_id || null,
              required_quantity: it.required_quantity || 1,
              is_free: it.is_free ?? false,
            }))
          )
        }
      }

      try {
        Storage.saveDeal(branchId, deal)
      } catch {
        // sync
      }
      return data as Deal
    } else {
      const { data, error } = await supabase
        .from('deals')
        .insert(dealPayload)
        .select()
        .single()
      if (error) throw error

      if (deal.items && deal.items.length > 0) {
        await supabase.from('deal_items').insert(
          deal.items.map((it) => ({
            deal_id: data.id,
            menu_item_id: it.menu_item_id || null,
            category_id: it.category_id || null,
            required_quantity: it.required_quantity || 1,
            is_free: it.is_free ?? false,
          }))
        )
      }

      try {
        Storage.saveDeal(branchId, { ...deal, id: data.id })
      } catch {
        // sync
      }
      return data as Deal
    }
  }

  return Storage.saveDeal(branchId, deal)
}

export async function toggleDealStatus(dealId: string, isActive: boolean): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('deals')
      .update({ is_active: isActive })
      .eq('id', dealId)
    if (error) console.warn('Supabase toggleDealStatus error:', error)
  }

  Storage.toggleDealActive(dealId, isActive)
}

export async function deleteDealRecord(dealId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId)
    if (error) console.warn('Supabase deleteDealRecord error:', error)
  }

  Storage.deleteDeal(dealId)
}

export async function fetchMenuItemsForDeals(branchId: string): Promise<MenuItem[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_available', true)
      .order('name', { ascending: true })
    if (!error && data) return data as MenuItem[]
  }

  return Storage.getMenuItems(branchId).filter((i) => i.is_available)
}
