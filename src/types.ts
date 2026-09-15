export interface Place {
  id: string
  name: string
  article: string
  type: string
  lat: number
  lng: number
  alt: string[]
  modernName: string
  score: number
  high: boolean
  verseCount: number
  first: string
  books: string[]
  ot: boolean
  nt: boolean
  refs: string[]
}

export interface Route {
  id: string
  num: number
  name: string
  cat: string
  era: 'ot' | 'nt'
  path: [number, number][]
}

export interface Territory {
  id: string
  name: string
  side: 'west' | 'east'
  color: string
  ring: [number, number][]
}

export type Era = 'all' | 'ot' | 'nt'

export const ROUTE_CATS = [
  'Patriarchs & Moses',
  'Exodus & Wilderness',
  'Conquest of Canaan',
  'Judges',
  'Kingdom of David & Solomon',
  'Kings, Prophets & Exile',
  'Life of Jesus',
  'Acts & Paul',
] as const

export const CAT_COLORS: Record<string, string> = {
  'Patriarchs & Moses': '#6d4c41',
  'Exodus & Wilderness': '#ef6c00',
  'Conquest of Canaan': '#c62828',
  Judges: '#ad1457',
  'Kingdom of David & Solomon': '#6a1b9a',
  'Kings, Prophets & Exile': '#4527a0',
  'Life of Jesus': '#1565c0',
  'Acts & Paul': '#00838f',
}