import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setSystemTheme } from '../../vitest.setup'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'
import { readStoredTheme } from './themeStorage'

/** A minimal consumer exercising `useTheme()`'s full public surface: the
 * resolved theme, rendered as text so assertions can read it back, and a
 * button that drives `toggleTheme`. */
function ThemeProbe() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <p data-testid="resolved-theme">{theme}</p>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // `data-theme` and the theme-color meta tag are written to the document
  // directly, outside the container @testing-library/react's automatic
  // cleanup unmounts, so each test starts from a clean document.
  document.documentElement.removeAttribute('data-theme')
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.remove())
})

describe('first launch, no explicit choice (3.1)', () => {
  it('resolves dark with no data-theme attribute when the system reports dark', () => {
    setSystemTheme('dark')

    renderProbe()

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark')
  })

  it('resolves light with no data-theme attribute when the system reports light', () => {
    setSystemTheme('light')

    renderProbe()

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light')
  })
})

describe('an explicit choice persists and outranks the system (3.2)', () => {
  it('writes data-theme="dark" to <html> and stores the choice when toggled', () => {
    setSystemTheme('light')
    renderProbe()
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('still resolves dark after remounting with the system now reporting light', () => {
    setSystemTheme('light')
    const { unmount } = renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    unmount()

    // Simulate a reload: a fresh mount, with the system preference still
    // (or again) light. The explicit choice made above was persisted, so
    // it must win over the system preference this time too.
    setSystemTheme('light')
    renderProbe()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark')
  })
})

describe('following a live system change with no explicit choice (3.3)', () => {
  it('updates the resolved theme without writing a data-theme attribute', () => {
    setSystemTheme('light')
    renderProbe()
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)

    // The subscription's listener updates React state outside of an
    // event handler, so the resulting re-render must be wrapped in act().
    act(() => {
      setSystemTheme('dark')
    })

    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('the theme-color meta tag tracks the resolved theme (3.5)', () => {
  it('updates the content of the single theme-color meta tag when the theme changes', () => {
    setSystemTheme('light')
    renderProbe()

    const metaTags = () => document.querySelectorAll('meta[name="theme-color"]')
    expect(metaTags()).toHaveLength(1)
    const lightContent = metaTags()[0].getAttribute('content')
    expect(lightContent).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    // Still exactly one tag - its content changed in place, no second tag
    // was appended (design.md, decision 12: "a single meta tag").
    expect(metaTags()).toHaveLength(1)
    const darkContent = metaTags()[0].getAttribute('content')
    expect(darkContent).toBeTruthy()
    expect(darkContent).not.toBe(lightContent)
  })
})
