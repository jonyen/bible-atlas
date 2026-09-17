import type { Place } from '../types'

export interface PlaceImage {
  /** The Wikipedia article the picture comes from. */
  title: string
  page: string
  thumb: string
  width: number
  height: number
  /** How far the article's own coordinate sits from the atlas's, in km. */
  km: number
  /** True when the article is simply near the place, not about it. */
  nearby?: boolean
  license: string
  artist?: string
}

export type PlaceImages = Record<string, PlaceImage>

/**
 * What to say under a photograph. A picture filed under the place's own name
 * needs no explanation; anything else does, because the reader is owed the
 * difference between a photograph *of* Shechem and one taken near it.
 */
export function imageCaption(image: PlaceImage, place: Place): string | null {
  if (image.nearby) {
    return image.km >= 1 ? `${image.title}, about ${image.km} km away` : `${image.title}, nearby`
  }
  const sameName = image.title.toLowerCase() === place.name.toLowerCase()
  return sameName ? null : image.title
}

let cache: Promise<PlaceImages> | null = null

/**
 * Photographs from Wikipedia, keyed by place id. Around 64 KB gzipped, loaded
 * with the first place panel rather than in the main bundle.
 */
export function loadImages(): Promise<PlaceImages> {
  cache ??= import('./images.json').then((m) => m.default as unknown as PlaceImages)
  return cache
}
