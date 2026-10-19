import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Storage } from '@/lib/storage'
import type { Profile, AppRole } from '@/types/domain'

export async function fetchStaffList(branchId: string): Promise<Profile[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`branch_id.eq.${branchId},role.eq.owner`)
      .order('full_name', { ascending: true })
    if (!error && data && data.length > 0) return data as Profile[]
  }

  return Storage.getStaff(branchId)
}

export async function verifyPinRpc(pin: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('verify_staff_pin', { p_pin: pin })
    if (error) throw error
    return Boolean(data)
  }
  return pin === '1234' || pin === '0000'
}

export async function setPinRpc(userId: string, pin: string): Promise<boolean> {
  if (pin.length < 4) throw new Error('PIN must be at least 4 digits')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('set_staff_pin', {
      p_user_id: userId,
      p_pin: pin,
    })
    if (error) throw error
    try {
      Storage.setStaffPin(userId)
    } catch {
      // local sync
    }
    return Boolean(data)
  }

  Storage.setStaffPin(userId)
  return true
}

export async function createStaffAccount(branchId: string, staff: {
  fullName: string
  role: AppRole
  email: string
}): Promise<Profile> {
  if (!staff.fullName.trim()) throw new Error('Staff full name is required')

  if (isSupabaseConfigured) {
    // Attempt insert into profiles; if service RPC exists, use it
    const newId = crypto.randomUUID()
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: newId,
        branch_id: staff.role === 'owner' ? null : branchId,
        full_name: staff.fullName.trim(),
        role: staff.role,
        is_active: true,
      })
      .select()
      .single()

    if (!error && data) {
      try {
        Storage.saveStaff(branchId, staff)
      } catch {
        // sync
      }
      return data as Profile
    }
  }

  return Storage.saveStaff(branchId, staff)
}
