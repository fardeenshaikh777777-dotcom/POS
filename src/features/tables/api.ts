import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { DiningTable, TableReservation } from '@/types/domain'

export async function fetchTablesWithOccupancy(branchId: string): Promise<DiningTable[]> {
  if (isSupabaseConfigured) {
    const { data: tables, error: tErr } = await supabase
      .from('dining_tables')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('label', { ascending: true })

    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, table_id, status')
      .eq('branch_id', branchId)
      .not('table_id', 'is', null)
      .in('status', ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served'])

    if (!tErr && tables && tables.length > 0) {
      return tables.map((t) => {
        const active = activeOrders?.find((o) => o.table_id === t.id)
        return {
          ...t,
          current_order_id: active?.id ?? null,
          current_order_status: active?.status ?? null,
        }
      }) as DiningTable[]
    }
  }

  return Storage.getTables(branchId)
}

export async function saveTableRecord(branchId: string, table: Partial<DiningTable>): Promise<DiningTable> {
  if (!table.label?.trim()) throw new Error('Table name or number is required')
  const seats = Number(table.seats) || 4
  if (seats <= 0) throw new Error('Capacity must be at least 1 person')

  if (isSupabaseConfigured) {
    if (table.id) {
      const { data, error } = await supabase
        .from('dining_tables')
        .update({
          label: table.label.trim(),
          seats,
          is_active: table.is_active ?? true,
        })
        .eq('id', table.id)
        .select()
        .single()
      if (error) throw error
      try {
        Storage.saveTable(branchId, table)
      } catch {
        // sync
      }
      return data as DiningTable
    } else {
      const { data, error } = await supabase
        .from('dining_tables')
        .insert({
          branch_id: branchId,
          label: table.label.trim(),
          seats,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      try {
        Storage.saveTable(branchId, table)
      } catch {
        // sync
      }
      return data as DiningTable
    }
  }

  return Storage.saveTable(branchId, table)
}

export async function fetchReservations(branchId: string): Promise<TableReservation[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('table_reservations')
      .select('*, table:dining_tables(*)')
      .eq('branch_id', branchId)
      .order('reservation_time', { ascending: true })
    if (!error && data && data.length > 0) return data as TableReservation[]
  }

  return Storage.getReservations(branchId)
}

export async function saveReservationRecord(branchId: string, data: {
  id?: string
  tableId: string
  customerName: string
  customerPhone: string
  guestCount: number
  reservationTime: string
  notes?: string
  status?: TableReservation['status']
}): Promise<TableReservation> {
  if (!data.customerName.trim()) throw new Error('Guest name is required')
  if (!data.customerPhone.trim()) throw new Error('Guest phone number is required')
  if (data.guestCount <= 0) throw new Error('Guest count must be at least 1')

  const resDate = new Date(data.reservationTime)
  if (isNaN(resDate.getTime())) throw new Error('Invalid reservation date and time')

  // Check conflicts in current reservation state
  const existingRes = await fetchReservations(branchId)
  const conflict = existingRes.find((existing) => {
    if (existing.id === data.id) return false
    if (existing.table_id !== data.tableId) return false
    if (existing.status === 'cancelled' || existing.status === 'completed') return false
    const diffMinutes = Math.abs((new Date(existing.reservation_time).getTime() - resDate.getTime()) / 60000)
    return diffMinutes < 120
  })

  if (conflict) {
    throw new Error(
      `Table conflict: An active reservation for "${conflict.customer_name}" is already scheduled within 2 hours at ${new Date(conflict.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    )
  }

  if (isSupabaseConfigured) {
    if (data.id) {
      const { data: updated, error } = await supabase
        .from('table_reservations')
        .update({
          table_id: data.tableId,
          customer_name: data.customerName.trim(),
          customer_phone: data.customerPhone.trim(),
          guest_count: data.guestCount,
          reservation_time: resDate.toISOString(),
          notes: data.notes?.trim() || null,
          status: data.status || 'confirmed',
        })
        .eq('id', data.id)
        .select('*, table:dining_tables(*)')
        .single()
      if (error) throw error
      try {
        Storage.saveReservation(branchId, data)
      } catch {
        // sync
      }
      return updated as TableReservation
    } else {
      const { data: inserted, error } = await supabase
        .from('table_reservations')
        .insert({
          branch_id: branchId,
          table_id: data.tableId,
          customer_name: data.customerName.trim(),
          customer_phone: data.customerPhone.trim(),
          guest_count: data.guestCount,
          reservation_time: resDate.toISOString(),
          notes: data.notes?.trim() || null,
          status: data.status || 'confirmed',
        })
        .select('*, table:dining_tables(*)')
        .single()
      if (error) throw error
      try {
        Storage.saveReservation(branchId, data)
      } catch {
        // sync
      }
      return inserted as TableReservation
    }
  }

  return Storage.saveReservation(branchId, data)
}

export async function updateReservationStatus(
  reservationId: string,
  status: 'confirmed' | 'seated' | 'cancelled' | 'completed'
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('table_reservations')
      .update({ status })
      .eq('id', reservationId)
    if (error) throw error
  }
  Storage.updateReservationStatus(reservationId, status)
}

// Backward compatibility alias
export const createTable = (branchId: string, label: string, seats: number) =>
  saveTableRecord(branchId, { label, seats })

export const createReservation = (branchId: string, data: {
  tableId: string
  customerName: string
  customerPhone: string
  guestCount: number
  reservationTime: string
  notes?: string
}) => saveReservationRecord(branchId, data)
