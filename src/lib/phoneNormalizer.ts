/**
 * Phone number normalization for Pakistani & international mobile numbers.
 * Normalizes phone variations into standard international E.164-compatible format (+923xxxxxxxxx)
 * to prevent duplicate customer profiles.
 */

export function normalizePhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return ''
  // Strip whitespace, hyphens, parentheses, and dots
  const clean = rawPhone.trim().replace(/[\s\-().]/g, '')
  if (!clean) return ''

  // 0092... -> +92...
  if (clean.startsWith('0092')) {
    return '+' + clean.slice(2)
  }

  // 03xx-xxxxxxx (Standard Pakistan domestic mobile) -> +923xxxxxxxxx
  if (/^03\d{9}$/.test(clean)) {
    return '+92' + clean.slice(1)
  }

  // 923xxxxxxxxx without leading plus
  if (/^92\d{10}$/.test(clean)) {
    return '+' + clean
  }

  // 3xxxxxxxxx (10 digits starting with 3, missing 0 or +92)
  if (/^3\d{9}$/.test(clean)) {
    return '+92' + clean
  }

  // If already starts with '+', return with clean digits
  if (clean.startsWith('+')) {
    return clean
  }

  // If digits only with at least 8 digits
  if (/^\d{8,15}$/.test(clean)) {
    return '+' + clean
  }

  return clean
}

export function formatPakistaniPhone(phone?: string | null): string {
  if (!phone) return '—'
  const norm = normalizePhoneNumber(phone)
  // Format +923001234567 as 0300-1234567 for display familiarity
  if (/^\+923\d{9}$/.test(norm)) {
    const local = '0' + norm.slice(3)
    return `${local.slice(0, 4)}-${local.slice(4)}`
  }
  return norm || phone
}

export function isValidPhoneNumber(phone?: string | null): boolean {
  if (!phone) return false
  const norm = normalizePhoneNumber(phone)
  // At least 9 digits and maximum 16 characters
  return /^\+?\d{8,15}$/.test(norm)
}
