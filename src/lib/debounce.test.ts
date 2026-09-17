import { afterEach, describe, expect, test, vi } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  afterEach(() => vi.useRealTimers())

  test('runs once after the calls stop', () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const run = debounce((n: number) => calls.push(n), 200)

    run(1)
    run(2)
    run(3)
    vi.advanceTimersByTime(199)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual([3])
  })

  test('keeps the last arguments, not the first', () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const run = debounce((s: string) => calls.push(s), 100)

    run('early')
    vi.advanceTimersByTime(50)
    run('late')
    vi.advanceTimersByTime(100)
    expect(calls).toEqual(['late'])
  })

  test('restarts the wait on every call, so a fast run ends in one call', () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const run = debounce(() => calls.push(1), 100)

    for (let i = 0; i < 10; i++) {
      run()
      vi.advanceTimersByTime(90)
    }
    expect(calls).toEqual([])
    vi.advanceTimersByTime(100)
    expect(calls).toEqual([1])
  })

  test('cancel drops a pending call', () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const run = debounce(() => calls.push(1), 100)

    run()
    run.cancel()
    vi.advanceTimersByTime(500)
    expect(calls).toEqual([])
  })
})
