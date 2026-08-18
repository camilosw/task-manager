import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How long a confirmation stays on screen before clearing itself (see
 * specs/action-feedback/spec.md, "The confirmation disappears on its own",
 * and design.md, decision 7). Long enough for a screen reader to finish
 * announcing the message, short enough to still read as transient. A single
 * named constant, so it is one edit if it proves wrong.
 */
const FEEDBACK_DURATION_MS = 3000

export type ActionFeedback = {
  /** The current confirmation text, or `''` when nothing is showing. Meant
   * to be rendered as the text content of the always-mounted live region
   * from design.md, decision 7 — the text changes in place, the region is
   * never inserted or removed. */
  message: string
  /** Shows `message`, replacing whatever confirmation is currently visible
   * and restarting the clear timer from this call. Calling `show` again
   * before the previous message has cleared does not stack the two — only
   * the newest message is ever visible (specs/action-feedback/spec.md, "A
   * second action replaces the first confirmation"). */
  show: (message: string) => void
}

/**
 * Owns the transient confirmation shown after a task is created, completed,
 * or deleted, and after the day is recalculated (see
 * specs/action-feedback/spec.md). Pure UI-layer state, independent of
 * `AppStateProvider` — `TaskManagerApp` calls `show()` at each call site,
 * once the corresponding action has actually taken effect (design.md,
 * decision 7: wrapping at the boundary keeps the store ignorant of the UI).
 */
export function useActionFeedback(): ActionFeedback {
  const [message, setMessage] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
    }
    setMessage(next)
    timeoutRef.current = setTimeout(() => {
      setMessage('')
      timeoutRef.current = null
    }, FEEDBACK_DURATION_MS)
  }, [])

  // Clears any pending timer on unmount so it never fires a state update
  // after the component tree using this hook is gone.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { message, show }
}
