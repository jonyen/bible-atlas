/** A debounced function: the wrapped call, plus a way to drop a pending one. */
export interface Debounced<A extends unknown[]> {
  (...args: A): void
  cancel: () => void
}

/**
 * Run `fn` once the calls stop, `ms` after the last one. Each call restarts the
 * wait and replaces the arguments, so a burst — a reader holding down the
 * scrubber's arrow — ends in a single run with where they actually landed.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = (...args: A) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, ms)
  }

  run.cancel = () => {
    clearTimeout(timer)
    timer = undefined
  }

  return run
}
