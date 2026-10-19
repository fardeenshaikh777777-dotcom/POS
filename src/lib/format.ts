const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

/** Format a PKR amount. Amounts are stored as numeric(12,2); display whole rupees. */
export function formatPKR(amount: number): string {
  return pkr.format(amount)
}

/** Round to 2 decimals without float drift (for client-side previews only; server is authoritative). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Returns the current or given date formatted as YYYY-MM-DD in Asia/Karachi time zone. */
export function getKarachiBusinessDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Returns the hour (0-23) in Asia/Karachi time zone. */
export function getKarachiHour(date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      hour12: false,
    })
    const val = parseInt(formatter.format(date), 10)
    return isNaN(val) ? date.getHours() : (val === 24 ? 0 : val)
  } catch {
    return date.getHours()
  }
}

/** Normalize any date/datetime/string into YYYY-MM-DD in Asia/Karachi. */
export function normalizeKarachiDate(dateOrStr?: string | Date | null): string {
  if (!dateOrStr) return getKarachiBusinessDate()
  if (typeof dateOrStr === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateOrStr)) {
      return dateOrStr.slice(0, 10)
    }
    const parsed = new Date(dateOrStr)
    if (!isNaN(parsed.getTime())) {
      return getKarachiBusinessDate(parsed)
    }
    return dateOrStr.slice(0, 10)
  }
  return getKarachiBusinessDate(dateOrStr)
}

/** Format a date string into human-friendly relative time (e.g. Just now, 5 mins ago, 2 hrs ago). */
export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return 'Just now'
  const time = new Date(dateString).getTime()
  if (isNaN(time)) return 'Just now'
  const diffMs = Math.max(0, Date.now() - time)
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 45) return 'Just now'
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return new Date(dateString).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}


