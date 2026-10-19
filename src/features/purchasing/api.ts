import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Supplier, PurchaseOrder } from '@/types/domain'

export async function fetchSuppliers(branchId: string): Promise<Supplier[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (!error && data) return data as Supplier[]
  }

  return [
    {
      id: 'sup-1',
      branch_id: branchId,
      name: 'Clifton Wholesale Poultry',
      contact_person: 'Haji Rafiq',
      phone: '0300-9281721',
      email: 'cliftonpoultry@gmail.com',
      address: 'Korangi Meat Market, Karachi',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sup-2',
      branch_id: branchId,
      name: 'Metro Cash & Carry Hub',
      contact_person: 'Tariq Mehmood',
      phone: '0321-8822119',
      email: 'metro.khi@orders.pk',
      address: 'Stargate Flyover, Karachi',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]
}

export async function createSupplier(branchId: string, supplier: Partial<Supplier>): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('suppliers').insert({
      branch_id: branchId,
      name: supplier.name,
      contact_person: supplier.contact_person || null,
      phone: supplier.phone || null,
      email: supplier.email || null,
      address: supplier.address || null,
      is_active: true,
    })
    if (error) throw error
  }
}

export async function fetchPurchaseOrders(branchId: string): Promise<PurchaseOrder[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:purchase_order_items(*, inventory_item:inventory_items(*))')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    if (!error && data) return data as PurchaseOrder[]
  }

  return [
    {
      id: 'po-1',
      branch_id: branchId,
      supplier_id: 'sup-1',
      po_number: 'PO-2026-001',
      status: 'received',
      total_amount: 18500,
      invoice_no: 'INV-7890',
      notes: 'Weekly fresh broiler chicken batch',
      ordered_at: new Date(Date.now() - 86400000).toISOString(),
      received_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      supplier: {
        id: 'sup-1',
        branch_id: branchId,
        name: 'Clifton Wholesale Poultry',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    },
  ]
}

export async function createPurchaseOrderRpc(params: {
  branchId: string
  supplierId: string
  poNumber: string
  invoiceNo?: string
  notes?: string
  items: Array<{ inventory_item_id: string; quantity: number; unit_cost: number }>
}): Promise<{ id: string; po_number: string; total: number }> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('create_purchase_order', {
      p_branch_id: params.branchId,
      p_supplier_id: params.supplierId,
      p_po_number: params.poNumber,
      p_invoice_no: params.invoiceNo || null,
      p_notes: params.notes || null,
      p_items: params.items,
    })
    if (error) throw error
    return data
  }

  return { id: crypto.randomUUID(), po_number: params.poNumber, total: 10000 }
}

export async function receivePurchaseOrderRpc(poId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('receive_purchase_order', {
      p_po_id: poId,
    })
    if (error) throw error
  }
}
