import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useActionFeedback } from './useActionFeedback'

describe('useActionFeedback (4.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts empty and exposes whatever message show() is called with', () => {
    const { result } = renderHook(() => useActionFeedback())
    expect(result.current.message).toBe('')

    act(() => {
      result.current.show('Task added')
    })

    expect(result.current.message).toBe('Task added')
  })

  it('clears itself after the interval when left alone', () => {
    const { result } = renderHook(() => useActionFeedback())

    act(() => {
      result.current.show('Task added')
    })
    expect(result.current.message).toBe('Task added')

    // Just under the interval: still visible.
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(result.current.message).toBe('Task added')

    // The interval elapses: it clears itself, with no user action.
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.message).toBe('')
  })

  it('replaces the first message and restarts the interval, rather than stacking', () => {
    const { result } = renderHook(() => useActionFeedback())

    act(() => {
      result.current.show('Task completed')
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.message).toBe('Task completed')

    act(() => {
      result.current.show('Task deleted')
    })
    // Only the new message is visible - the first is gone immediately, not
    // queued behind it.
    expect(result.current.message).toBe('Task deleted')

    // 2000ms further on (4000ms since the first show(), 2000ms since the
    // second): the first message's original 3000ms interval has long
    // passed, but the message must still be showing because the second
    // show() restarted the clock rather than leaving the first timer
    // running.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.message).toBe('Task deleted')

    // The remaining 1000ms of the second call's own 3000ms interval: now it
    // clears.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.message).toBe('')
  })
})
