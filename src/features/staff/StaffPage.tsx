import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchStaffList, setPinRpc, verifyPinRpc, createStaffAccount } from './api'
import type { Profile, AppRole } from '@/types/domain'

export function StaffPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [staffList, setStaffList] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // PIN Modal
  const [pinModalUser, setPinModalUser] = useState<Profile | null>(null)
  const [newPin, setNewPin] = useState('')
  const [submittingPin, setSubmittingPin] = useState(false)

  // Verify PIN Test Modal
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [testPin, setTestPin] = useState('')
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  // Add Staff Modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState<AppRole>('cashier')
  const [staffEmail, setStaffEmail] = useState('')
  const [submittingStaff, setSubmittingStaff] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStaffList(branchId)
      setStaffList(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSavePin = async () => {
    if (!pinModalUser || newPin.length < 4) return
    setSubmittingPin(true)
    try {
      await setPinRpc(pinModalUser.id, newPin)
      setPinModalUser(null)
      setNewPin('')
      setSuccessMsg(`Security PIN for ${pinModalUser.full_name} updated successfully.`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`PIN error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmittingPin(false)
    }
  }

  const handleVerifyTest = async () => {
    if (!testPin) return
    try {
      const match = await verifyPinRpc(testPin)
      setVerifyResult(match ? '✅ Valid PIN verified!' : '❌ Incorrect PIN entered.')
    } catch (err) {
      setVerifyResult(`⚠️ ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCreateStaff = async () => {
    if (!staffName.trim()) return
    setSubmittingStaff(true)
    try {
      const created = await createStaffAccount(branchId, {
        fullName: staffName.trim(),
        role: staffRole,
        email: staffEmail.trim() || `${staffRole}@karachiexpress.pk`,
      })
      setAddModalOpen(false)
      setStaffName('')
      setStaffEmail('')
      setSuccessMsg(`Staff member "${created.full_name}" (${created.role.toUpperCase()}) added successfully!`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Staff error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmittingStaff(false)
    }
  }

  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (r) => (
        <div>
          <strong>{r.full_name}</strong>
          {r.id === profile?.id && <Badge tone="info" style={{ marginLeft: '6px' }}>YOU</Badge>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (r) => {
        let tone: 'ok' | 'warn' | 'info' | 'neutral' = 'neutral'
        if (r.role === 'owner') tone = 'warn'
        if (r.role === 'manager') tone = 'ok'
        if (r.role === 'cashier') tone = 'info'
        return <Badge tone={tone}>{r.role.toUpperCase()}</Badge>
      },
    },
    {
      key: 'pin',
      header: 'Security PIN',
      render: (r) => (
        <span style={{ fontSize: 'var(--fs-xs)' }}>
          {r.pin_set_at ? '🔒 Configured' : '⚠️ No PIN Set'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={r.is_active ? 'ok' : 'danger'}>
          {r.is_active ? 'ACTIVE' : 'DEACTIVATED'}
        </Badge>
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
            setPinModalUser(r)
            setNewPin('')
          }}
        >
          🔑 Set PIN
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Staff & Role Security"
        subtitle="Manage restaurant team permissions, shift authorizations, and encrypted security PINs"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setVerifyModalOpen(true)}>
              🔍 Test PIN Verification
            </Button>
            <Button variant="primary" onClick={() => setAddModalOpen(true)}>
              + Add Staff Member
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

      {loading && <LoadingState label="Loading staff profiles and access permissions…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && (
        <Card title="Branch Staff Roster">
          <DataTable columns={columns} rows={staffList} rowKey={(r) => r.id} />
        </Card>
      )}

      {/* Set PIN Modal */}
      {pinModalUser && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Set Security PIN</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Assign a 4 to 8 digit numeric security PIN for <strong>{pinModalUser.full_name}</strong>.
              PINs are encrypted server-side with bcrypt; no default PINs are permitted.
            </p>

            <Field
              id="pin"
              label="Enter New PIN (4-8 digits)"
              type="password"
              placeholder="••••"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setPinModalUser(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={submittingPin}
                onClick={handleSavePin}
                disabled={newPin.length < 4}
              >
                Save Encrypted PIN
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test Verify PIN Modal */}
      {verifyModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Verify Staff Authorization PIN</h2>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Tests the trusted server-side PIN verification RPC. Failed attempts increment the lockout counter.
            </p>

            <Field
              id="tpin"
              label="Enter PIN to Verify"
              type="password"
              placeholder="••••"
              value={testPin}
              onChange={(e) => {
                setTestPin(e.target.value)
                setVerifyResult(null)
              }}
            />

            {verifyResult && (
              <div style={{ marginTop: '12px', padding: '10px', background: 'var(--surface-muted)', borderRadius: 'var(--radius)', fontWeight: 600 }}>
                {verifyResult}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setVerifyModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={handleVerifyTest} disabled={!testPin}>
                Verify PIN
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {addModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Add Team Member</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <Field
                id="sname"
                label="Full Name"
                placeholder="e.g. Faraz Ahmed"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />

              <div>
                <label className="field__label">Operational Role</label>
                <select
                  className="input"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as AppRole)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="cashier">Cashier (POS & Cash Drawer)</option>
                  <option value="waiter">Waiter (POS & Dining Tables)</option>
                  <option value="kitchen">Kitchen Chef (KDS & Recipe Stock)</option>
                  <option value="manager">Branch Manager (Full Branch Access)</option>
                </select>
              </div>

              <Field
                id="semail"
                label="Account Email"
                placeholder="staff@karachiexpress.pk"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submittingStaff}
                  onClick={handleCreateStaff}
                  disabled={!staffName.trim()}
                >
                  Save Staff Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
