import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, Button, Badge, LoadingState, ErrorState, DataTable, Column, Field } from '@/components/ui'
import { formatPKR } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchExpenses, recordExpenseRpc } from './api'
import { fetchActiveCashSession } from '@/features/cash/api'
import type { Expense, PaymentMethod } from '@/types/domain'

export function ExpensesPage() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id || '635c7b14-54be-4b93-a75a-e2ddc0323827'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | string | null>(null)

  // Record Expense Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [category, setCategory] = useState<Expense['category']>('supplies')
  const [amount, setAmount] = useState<number>(1500)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [expList, session] = await Promise.all([
        fetchExpenses(branchId),
        fetchActiveCashSession(branchId),
      ])
      setExpenses(expList)
      setActiveSessionId(session?.id || null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRecordExpense = async () => {
    if (amount <= 0) {
      alert('Expense amount must be greater than zero')
      return
    }
    if (!description.trim()) {
      alert('Voucher description is required')
      return
    }

    setSubmitting(true)
    try {
      await recordExpenseRpc({
        branchId,
        category,
        amount,
        paymentMethod,
        cashSessionId: paymentMethod === 'cash' ? activeSessionId : null,
        description: description.trim(),
        vendor: vendor.trim() || null,
      })
      setModalOpen(false)
      setDescription('')
      setVendor('')
      setAmount(1500)
      setSuccessMsg(`Recorded expense voucher: ${description.trim()} (${formatPKR(amount)})`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (err) {
      alert(`Expense error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0)

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date & Time',
      render: (r) => (
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {new Date(r.created_at).toLocaleString('en-GB')}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => (
        <div>
          <strong>{r.description}</strong>
          {r.vendor && <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>Vendor: {r.vendor}</span>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => (
        <Badge tone="neutral">{r.category.toUpperCase().replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'method',
      header: 'Paid Via',
      render: (r) => (
        <span style={{ textTransform: 'uppercase', fontSize: 'var(--fs-xs)' }}>
          {r.payment_method} {r.cash_session_id ? '(Drawer)' : ''}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount (PKR)',
      numeric: true,
      render: (r) => <strong style={{ color: 'var(--danger)' }}>{formatPKR(r.amount)}</strong>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Expense Management"
        subtitle="Operational overheads, vendor payouts, and petty cash disbursements"
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Record Expense
          </Button>
        }
      />

      {successMsg && (
        <div style={{ background: 'var(--ok-bg, #dcefe4)', color: 'var(--ok, #2f7d57)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div className="stat-card" style={{ maxWidth: '320px' }}>
          <span className="stat-card__label">Total Recorded Expenses</span>
          <span className="stat-card__val" style={{ color: 'var(--danger)' }}>
            {formatPKR(totalExpenseAmount)}
          </span>
          <span className="stat-card__hint">{expenses.length} expense vouchers</span>
        </div>
      </div>

      {loading && <LoadingState label="Loading branch expenses…" />}
      {error && <ErrorState error={error} onRetry={loadData} />}

      {!loading && !error && (
        <Card title="Expense Vouchers Log">
          <DataTable columns={columns} rows={expenses} rowKey={(r) => r.id} />
        </Card>
      )}

      {/* Record Expense Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Record Operational Expense</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label className="field__label">Category</label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Expense['category'])}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="supplies">Kitchen & Packaging Supplies</option>
                  <option value="raw_materials">Raw Materials & Perishables</option>
                  <option value="utilities">Utilities (LPG, Electricity, Water)</option>
                  <option value="maintenance">Maintenance & Repairs</option>
                  <option value="salaries">Daily Staff Wages / Advance</option>
                  <option value="marketing">Local Promotion & Flyers</option>
                  <option value="other">Other Operational Cost</option>
                </select>
              </div>

              <Field
                id="eamt"
                label="Amount (PKR)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />

              <div>
                <label className="field__label">Payment Channel</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    className={`btn ${paymentMethod === 'cash' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setPaymentMethod('cash')}
                    style={{ flex: 1 }}
                  >
                    💵 Cash Drawer
                  </button>
                  <button
                    className={`btn ${paymentMethod === 'bank_transfer' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setPaymentMethod('bank_transfer')}
                    style={{ flex: 1 }}
                  >
                    🏦 Bank Transfer
                  </button>
                </div>
                {paymentMethod === 'cash' && (
                  <p className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                    * Cash expenses automatically deduct from the active register till.
                  </p>
                )}
              </div>

              <Field
                id="edesc"
                label="Voucher Description / Purpose"
                placeholder="e.g. Bought 20 kg tomatoes from local mandi"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Field
                id="evendor"
                label="Vendor / Recipient Name"
                placeholder="e.g. Clifton Vegetable Market"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={handleRecordExpense}
                  disabled={amount <= 0 || !description.trim()}
                >
                  Confirm Expense
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
