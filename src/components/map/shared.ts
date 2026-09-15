import { PLACES, byId } from '../../data'
import type { Place, Territory } from '../../types'
import type { Route } from '../../types'
import {
  BOTH_COLOR,
  MAX_MARKERS,
  NT_COLOR,
  OT_COLOR,
  type ViewportBounds,
} from './types'

export type MapEra = 'all' | 'ot' | 'nt'

export function placeColor(p: Place, era: MapEra): string {
  if (era === 'ot') return OT_COLOR
  if (era === 'nt') return NT_COLOR
  return p.nt && !p.ot ? NT_COLOR : p.ot && !p.nt ? OT_COLOR : BOTH_COLOR
}

export function eraMatch(p: Place, era: MapEra): boolean {
  if (era === 'all') return true
  if (era === 'ot') return p.ot || (!p.ot && !p.nt)
  return p.nt || (!p.ot && !p.nt)
}

/** Places in view (with fuzzy margin padding), filtered and capped by confidence rank. */
export function visiblePlaces(bounds: ViewportBounds, era: MapEra): Place[] {
  const latPad = (bounds.north - bounds.south) * 0.25
  const lngPad = (bounds.east - bounds.west) * 0.25
  const list: Place[] = []
  for (const p of PLACES) {
    if (!eraMatch(p, era)) continue
    if (p.lat < bounds.south - latPad || p.lat > bounds.north + latPad) continue
    if (p.lng < bounds.west - lngPad || p.lng > bounds.east + lngPad) continue
    list.push(p)
    if (list.length >= MAX_MARKERS) break
  }
  return list
}

export function findPlace(id: string): Place | undefined {
  return byId.get(id)
}

export function placeInfoNode(p: Place, onOpen: () => void): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  const title = `${p.article ? p.article + ' ' : ''}${p.name}`
  el.innerHTML = `
    <h3>${title}</h3>
    <p class="iw-type">${p.type}${p.alt.length ? ' · also ' + p.alt.slice(0, 3).join(', ') : ''}</p>
    <p class="iw-sub">${p.verseCount} verse${p.verseCount === 1 ? '' : 's'} · ${p.books.slice(0, 4).join(', ')}${p.books.length > 4 ? '…' : ''}</p>
    <button type="button" class="iw-btn">View details</button>`
  el.querySelector('button')?.addEventListener('click', onOpen)
  return el
}

export function routeInfoNode(r: Route): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  el.innerHTML = `<h3>${r.name}</h3><p class="iw-sub">${r.cat}</p>`
  return el
}

export function territoryInfoNode(t: Territory): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'iw'
  el.innerHTML = `<h3>${t.name}</h3><p class="iw-sub">${t.side === 'west' ? 'West of the Jordan' : 'East of the Jordan'} · approximate allotment (Josh. 13–19)</p>`
  return el
}