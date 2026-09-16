export const GOOGLE_LOAD_LIMIT =
  Number(import.meta.env.VITE_GOOGLE_LOAD_LIMIT) || 2000
const KEY = 'ba.usage'

function monthKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${m}`
}

export interface Usage {
  month: string
  loads: number
}

export function getUsage(): Usage {
  const month = monthKey()
  let loads = 0
  try {
    loads = Number(localStorage.getItem(`${KEY}.${month}`)) || 0
  } catch {
    /* storage unavailable */
  }
  return { month, loads }
}

/** Counts one billable map load for the current month. No-op in dev. */
export function recordLoad(): Usage {
  const month = monthKey()
  if (import.meta.env.DEV) return { month, loads: getUsage().loads }
  let loads = 1
  try {
    loads = (Number(localStorage.getItem(`${KEY}.${month}`)) || 0) + 1
    localStorage.setItem(`${KEY}.${month}`, String(loads))
  } catch {
    /* storage unavailable */
  }
  return { month, loads }
}

export function isAtGoogleLoadLimit(usage: Usage = getUsage()): boolean {
  return usage.loads >= GOOGLE_LOAD_LIMIT
}