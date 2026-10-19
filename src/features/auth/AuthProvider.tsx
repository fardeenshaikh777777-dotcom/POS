import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile, AppRole } from '@/types/domain'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileError: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  switchDemoRole: (role: AppRole) => void
  signOut: () => Promise<void>
}

const DEMO_PROFILES: Record<AppRole, Profile> = {
  owner: {
    id: 'a0000000-0000-0000-0000-000000000001',
    branch_id: '635c7b14-54be-4b93-a75a-e2ddc0323827',
    role: 'owner',
    full_name: 'Tariq Khan (Owner)',
    is_active: true,
  },
  manager: {
    id: 'a0000000-0000-0000-0000-000000000002',
    branch_id: '635c7b14-54be-4b93-a75a-e2ddc0323827',
    role: 'manager',
    full_name: 'Bilal Ahmed (Manager)',
    is_active: true,
  },
  cashier: {
    id: 'a0000000-0000-0000-0000-000000000003',
    branch_id: '635c7b14-54be-4b93-a75a-e2ddc0323827',
    role: 'cashier',
    full_name: 'Zeeshan Ali (Cashier)',
    is_active: true,
  },
  kitchen: {
    id: 'a0000000-0000-0000-0000-000000000004',
    branch_id: '635c7b14-54be-4b93-a75a-e2ddc0323827',
    role: 'kitchen',
    full_name: 'Ustad Bashir (Head Chef)',
    is_active: true,
  },
  waiter: {
    id: 'a0000000-0000-0000-0000-000000000005',
    branch_id: '635c7b14-54be-4b93-a75a-e2ddc0323827',
    role: 'waiter',
    full_name: 'Danish Raza (Waiter)',
    is_active: true,
  },
}

const LOCAL_PROFILE_KEY = 'karachi_pos_active_profile'

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_PROFILE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [profileError, setProfileError] = useState<string | null>(null)

  const loadProfile = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      if (!isSupabaseConfigured) {
        // Keep active demo profile if present
        setLoading(false)
        return
      }
      setProfile(null)
      setProfileError(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, branch_id, role, full_name, is_active')
      .eq('id', s.user.id)
      .maybeSingle()

    if (error || !data || !data.is_active) {
      setProfile(null)
      setProfileError('Your account has no active staff profile. Contact the owner.')
    } else {
      setProfile(data as Profile)
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(data))
      setProfileError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
        setTimeout(() => void loadProfile(s), 0)
      })
      return () => sub.subscription.unsubscribe()
    } else {
      // Default to Owner if no profile set
      setProfile((current) => {
        if (!current) {
          const defaultOwner = DEMO_PROFILES.owner
          localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(defaultOwner))
          return defaultOwner
        }
        return current
      })
      setLoading(false)
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? 'Invalid email or password.' : null
    }
    // Match demo accounts
    const match = Object.values(DEMO_PROFILES).find((p) => email.toLowerCase().includes(p.role))
    if (match) {
      setProfile(match)
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(match))
      return null
    }
    return 'Invalid demo credentials.'
  }, [])

  const switchDemoRole = useCallback((role: AppRole) => {
    const p = DEMO_PROFILES[role]
    setProfile(p)
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(p))
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setProfile(null)
    setSession(null)
    localStorage.removeItem(LOCAL_PROFILE_KEY)
  }, [])

  const value = useMemo(
    () => ({ loading, session, profile, profileError, signIn, switchDemoRole, signOut }),
    [loading, session, profile, profileError, signIn, switchDemoRole, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
