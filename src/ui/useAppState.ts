import { useContext } from 'react'
import { AppStateContext, type AppState } from './appStateContext'

/**
 * Reads application state from the nearest `AppStateProvider`. Throws when
 * used outside one, since there is no sensible fallback state.
 */
export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (state === null) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return state
}
