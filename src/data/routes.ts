import type { Route } from '../types'

let routes: Promise<Route[]> | null = null

/** Routes are ~450 KB, so they load on first use instead of in the main bundle. */
export function loadRoutes(): Promise<Route[]> {
  routes ??= import('./routes.json').then((m) => m.default.routes as unknown as Route[])
  return routes
}
