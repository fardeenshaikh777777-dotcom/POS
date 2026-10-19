import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, LoadingState, ErrorState, Field } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchBranchSettings, updateBranchSettings, triggerSeedDemoRestaurant } from './api'
import type { Branch } from '@/types/domain'

export function SettingsPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [settings, setSettings] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBranchSettings(branchId)
      setSettings(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    try {
      await updateBranchSettings(branchId, settings)
      setMessage('✅ Restaurant settings saved successfully.')
    } catch (err) {
      alert(`Save error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSeedDemo = async () => {
    if (!confirm('This will populate or restore demo categories, dishes, tables, ingredients and recipes. Continue?')) {
      return
    }
    setSeeding(true)
    setMessage(null)
    try {
      const res = await triggerSeedDemoRestaurant()
      setMessage(`✅ Demo restaurant data verified: ${res.branch_name}`)
      await loadSettings()
    } catch (err) {
      alert(`Seed error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Restaurant Settings"
        subtitle="Branch configuration, sales tax rates, receipt customization, and presentation demo utilities"
        actions={
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        }
      />

      {loading && <LoadingState label="Loading branch configuration…" />}
      {error && <ErrorState error={error} onRetry={loadSettings} />}

      {message && (
        <div style={{ padding: '12px 16px', background: 'var(--ok-bg)', color: 'var(--ok)', borderRadius: 'var(--radius)', marginBottom: '16px', fontWeight: 600 }}>
          {message}
        </div>
      )}

      {!loading && !error && settings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          {/* Branch & Contact Info */}
          <Card title="Branch & Outlet Details">
            <div className="grid-2">
              <Field
                id="bname"
                label="Restaurant / Branch Name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
              <Field
                id="bcity"
                label="City / Jurisdiction"
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              />
              <Field
                id="bphone"
                label="Contact Telephone"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
              <Field
                id="baddr"
                label="Physical Address"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
          </Card>

          {/* Billing & Tax Settings */}
          <Card title="Billing, Currency & Tax Parameters">
            <div className="grid-3">
              <Field
                id="tax"
                label="Sindh Sales Tax on Food (SST %)"
                type="number"
                step="0.5"
                value={settings.tax_rate}
                onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                hint="Standard Sindh Revenue Board rate: 13.0%"
              />

              <Field
                id="curr"
                label="Currency Symbol"
                value={settings.currency_symbol}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
              />

              <Field
                id="deliv"
                label="Default Delivery Surcharge (PKR)"
                type="number"
                value={settings.delivery_fee}
                onChange={(e) => setSettings({ ...settings, delivery_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </Card>

          {/* Thermal Receipt Configuration */}
          <Card title="80mm Thermal Receipt Header & Footer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field
                id="rhead"
                label="Receipt Header Slogan"
                value={settings.receipt_header}
                onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                hint="Printed right below the restaurant title on customer receipts"
              />

              <Field
                id="rfoot"
                label="Receipt Footer Notice / Feedback Hotline"
                value={settings.receipt_footer}
                onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                hint="Printed at the bottom of customer receipts"
              />
            </div>
          </Card>

          {/* Demo Reset / Seeder Utility */}
          <Card title="Presentation Demo Data Generator">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>Restore Sample Karachi Express Data</h4>
                <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: '4px' }}>
                  Invokes the database seed procedure to populate authentic Karachi dishes, tables T1-T10, poultry & meat suppliers, and inventory recipes.
                </p>
              </div>
              <Button
                variant="accent"
                loading={seeding}
                onClick={handleSeedDemo}
              >
                ⚡ Initialize Demo Restaurant
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
