import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Branch } from '@/types/domain'

export async function fetchBranchSettings(branchId: string): Promise<Branch | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .maybeSingle()
    if (!error && data) return data as Branch
  }

  return {
    id: branchId,
    name: 'Karachi Express (Clifton Main)',
    city: 'Karachi',
    address: 'Plot 12-C, Block 4, Clifton, Karachi',
    phone: '021-35876543',
    tax_rate: 13.0,
    currency_symbol: 'Rs.',
    receipt_header: 'Karachi Express — Authentic Pakistani Flavours',
    receipt_footer: 'Thank you for dining with us! For catering: 0300-1234567',
    auto_deduct_stock: true,
    delivery_fee: 150.0,
    service_charge_rate: 0.0,
    is_active: true,
  }
}

export async function updateBranchSettings(branchId: string, updates: Partial<Branch>): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('branches')
      .update({
        name: updates.name,
        address: updates.address,
        phone: updates.phone,
        tax_rate: updates.tax_rate,
        currency_symbol: updates.currency_symbol,
        receipt_header: updates.receipt_header,
        receipt_footer: updates.receipt_footer,
        auto_deduct_stock: updates.auto_deduct_stock,
        delivery_fee: updates.delivery_fee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', branchId)
    if (error) throw error
  }
}

export async function triggerSeedDemoRestaurant(): Promise<{ branch_id: string; branch_name: string }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('seed_demo_restaurant')
    if (error) throw error
    return data
  }
  return { branch_id: 'demo-branch', branch_name: 'Karachi Express (Clifton Main)' }
}
