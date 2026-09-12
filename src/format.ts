import type { CellFormat } from './types'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string' && value !== '') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(value: unknown): string {
  const d = toDate(value)
  if (!d) return String(value ?? '')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDatetime(value: unknown): string {
  const d = toDate(value)
  if (!d) return String(value ?? '')
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!isFinite(n)) return String(value ?? '')
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 应用声明式格式化;null/undefined 由调用方先行处理成 '—'。 */
export function applyFormat<T>(format: CellFormat<T>, value: unknown, row: T): string {
  if (typeof format === 'function') return format(value, row)
  switch (format) {
    case 'date':
      return formatDate(value)
    case 'datetime':
      return formatDatetime(value)
    case 'money':
      return formatMoney(value)
  }
}
