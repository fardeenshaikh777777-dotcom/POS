import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, Field, Badge } from '@/components/ui'
import { useAuth } from './AuthProvider'
import { defaultPathFor } from '@/lib/modules'
import { isSupabaseConfigured } from '@/lib/supabase'
import type { AppRole } from '@/types/domain'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export function LoginPage() {
  const { profile, signIn, session, profileError, signOut, switchDemoRole } = useAuth()
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  if (profile) return <Navigate to={defaultPathFor(profile.role)} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = schema.safeParse({ email: fd.get('email'), password: fd.get('password') })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors({ email: f.email?.[0], password: f.password?.[0] })
      return
    }
    setErrors({})
    setBusy(true)
    const msg = await signIn(parsed.data.email, parsed.data.password)
    setBusy(false)
    if (msg) setErrors({ form: msg })
  }

  const handleQuickSignIn = async (role: AppRole, email: string) => {
    if (isSupabaseConfigured) {
      setBusy(true)
      const msg = await signIn(email, 'Karachi123!')
      setBusy(false)
      if (msg) setErrors({ form: msg })
    } else {
      switchDemoRole(role)
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Karachi Express POS</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: '4px' }}>
            Authentic restaurant operations management platform
          </p>
        </div>

        {isSupabaseConfigured && (
          <Badge tone="ok">Connected to Live Remote Supabase DB</Badge>
        )}

        {session && profileError && (
          <p className="field__error" role="alert">
            {profileError} <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>Sign out</button>
          </p>
        )}

        <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <Field id="email" name="email" type="email" label="Staff Email" defaultValue="owner@karachiexpress.pk" error={errors.email} />
          <Field id="password" name="password" type="password" label="Password" defaultValue="Karachi123!" error={errors.password} />
          {errors.form && <p className="field__error" role="alert">{errors.form}</p>}
          <Button type="submit" variant="primary" loading={busy}>Sign in to Station</Button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <span style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Quick Staff Role Switcher:
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn--sm btn--accent"
              onClick={() => handleQuickSignIn('owner', 'owner@karachiexpress.pk')}
            >
              👑 Owner (Tariq)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => handleQuickSignIn('manager', 'manager@karachiexpress.pk')}
            >
              💼 Manager (Bilal)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => handleQuickSignIn('cashier', 'cashier@karachiexpress.pk')}
            >
              💵 Cashier (Zeeshan)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => handleQuickSignIn('kitchen', 'kitchen@karachiexpress.pk')}
            >
              🍳 Chef (Ustad Bashir)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              style={{ gridColumn: 'span 2' }}
              onClick={() => handleQuickSignIn('waiter', 'waiter@karachiexpress.pk')}
            >
              🍽️ Waiter (Danish Raza)
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
