import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { toUserMessage } from '@/lib/errors'

type Variant = 'default' | 'primary' | 'accent' | 'danger' | 'ghost'

export function Button({
  variant = 'default', size, loading, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm'; loading?: boolean }) {
  const cls = ['btn', variant !== 'default' && `btn--${variant}`, size && `btn--${size}`].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden />}
      {children}
    </button>
  )
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title && (
        <header className="card__header">
          <h2>{title}</h2>
          {actions}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  style,
  className = '',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent'
  style?: React.CSSProperties
  className?: string
  children: ReactNode
}) {
  const toneClass = tone ? `badge--${tone}` : 'badge--neutral'
  return <span style={style} className={`badge ${toneClass} ${className}`.trim()}>{children}</span>
}

export function Field({
  label, hint, error, id, ...input
}: { label: string; hint?: string; error?: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span id={`${id}-err`} className="field__error" role="alert">{error}</span>}
    </div>
  )
}

/* ---- Standard async states ---- */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <span className="state__title">{title}</span>
      {message && <span>{message}</span>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <span className="state__title">Something went wrong</span>
      <span>{toUserMessage(error)}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

/* ---- Table ---- */
export interface Column<T> {
  key: string
  header: string
  numeric?: boolean
  render: (row: T) => ReactNode
}

export function DataTable<T>({
  columns, rows, rowKey, empty,
}: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records" />}</>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.numeric ? 'is-num' : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => <td key={c.key} className={c.numeric ? 'is-num num' : undefined}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
