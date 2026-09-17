import { describe, expect, it } from 'vitest'
import { PLACES } from '.'
import { DISPUTED, disputedNote } from './disputed'

describe('disputed places', () => {
  it('names only places that exist in the data', () => {
    const ids = new Set(PLACES.map((p) => p.id))
    const unknown = Object.keys(DISPUTED).filter((id) => !ids.has(id))
    expect(unknown).toEqual([])
  })

  it('only annotates places the data is already unsure of', () => {
    const byId = new Map(PLACES.map((p) => [p.id, p]))
    for (const id of Object.keys(DISPUTED)) expect(byId.get(id)?.high).toBe(false)
  })

  it('covers the Garden of Eden, the place readers will question first', () => {
    expect(disputedNote('af3daeb')).toMatch(/Eden/)
  })

  it('has no note for a place nobody disputes', () => {
    const jerusalem = PLACES.find((p) => p.name === 'Jerusalem')!
    expect(disputedNote(jerusalem.id)).toBeUndefined()
  })
})
