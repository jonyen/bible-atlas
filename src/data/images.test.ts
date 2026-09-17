import { describe, expect, it } from 'vitest'
import type { Place } from '../types'
import { PLACES } from '.'
import { imageCaption, loadImages, type PlaceImage } from './images'

const place = (name: string, modernName = '') => ({ name, modernName }) as Place

const image = (over: Partial<PlaceImage> = {}): PlaceImage => ({
  title: 'Nineveh',
  page: 'https://en.wikipedia.org/wiki/Nineveh',
  thumb: 'https://example.invalid/x.jpg',
  width: 640,
  height: 438,
  km: 0,
  license: 'CC BY-SA 4.0',
  artist: 'Somebody',
  ...over,
})

describe('imageCaption', () => {
  it('says nothing extra when the article is the place itself', () => {
    expect(imageCaption(image(), place('Nineveh'))).toBeNull()
  })

  it('names the modern site when the article is filed under another name', () => {
    expect(imageCaption(image({ title: 'Tel Rumeida' }), place('Hebron'))).toBe('Tel Rumeida')
  })

  it('admits when the photograph is only of somewhere near the place', () => {
    const caption = imageCaption(image({ title: 'Kafr Kanna church', nearby: true, km: 2 }), place('Cana'))
    expect(caption).toBe('Kafr Kanna church, about 2 km away')
  })

  it('reads naturally for a nearby place in the same kilometre', () => {
    const caption = imageCaption(image({ title: 'Tell Balata', nearby: true, km: 0 }), place('Shechem'))
    expect(caption).toBe('Tell Balata, nearby')
  })
})

describe('place images', () => {
  it('has a picture for the places a reader is most likely to open', async () => {
    const images = await loadImages()
    const byName = new Map(PLACES.map((p) => [p.name, p.id]))
    for (const name of ['Jerusalem', 'Bethlehem', 'Nineveh', 'Damascus']) {
      expect(images[byName.get(name)!]).toBeTruthy()
    }
  })

  it('credits every picture, since an uncredited one is not ours to show', async () => {
    const images = await loadImages()
    const uncredited = Object.values(images).filter((i) => !i.license)
    expect(uncredited).toEqual([])
  })

  it('only points at Wikimedia, never at a third-party host', async () => {
    const images = await loadImages()
    const foreign = Object.values(images).filter((i) => !/\.wikimedia\.org\//.test(i.thumb))
    expect(foreign).toEqual([])
  })
})
