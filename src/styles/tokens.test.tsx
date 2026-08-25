import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TaskForm } from '../ui/TaskForm'

// Raw source of the stylesheets under test, read from disk with `node:fs`
// rather than imported. A Vite `?raw` import was tried first, but this
// suite's default `test.css: false` (vite.config.ts) stubs out *every*
// `.css`-suffixed module, `?raw` query included, to an empty string — so a
// real disk read is what's needed. `node`'s ambient types are added to
// tsconfig.app.json's `types` (alongside `vite/client`/`vitest/globals`) to
// support this; `@types/node` was already a devDependency, used the same
// way by tsconfig.node.json for vite.config.ts itself.
function readSource(relativeToThisFile: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeToThisFile, import.meta.url)),
    'utf8',
  )
}

const tokensCss = readSource('./tokens.css')
const taskItemCss = readSource('../ui/TaskItem.css')
const priorityGroupsCss = readSource('../ui/PriorityGroups.css')
const taskFormCss = readSource('../ui/TaskForm.css')

/**
 * Pins tasks.md section 13 (specs/appearance/spec.md, "Recurring tasks have
 * their own color in both themes"): the recurrence badge on a task row, the
 * "Recurring" group heading, and the recurring choice in the creation/edit
 * form all resolve to the *same* dedicated color token, distinct from each
 * of the five priority tokens, declared for both the light and the dark
 * theme.
 *
 * There is no `getComputedStyle` assertion in this file: this suite runs
 * CSS imports as no-ops (`test.css` is left at its `vite.config.ts` default
 * of `false`), so a component rendered under jsdom never actually picks up
 * a stylesheet rule — `getComputedStyle` would just report browser
 * defaults, telling us nothing. What *is* checked, and is exactly what "the
 * same token" cashes out to structurally, is: the three consuming
 * stylesheets reference the same three `--recurring-*` custom-property
 * names (not the neutral `--surface-2`/`--text-muted` placeholders sections
 * 9/10 used); those names are declared for both themes in `tokens.css`,
 * mirroring the file's own documented "declared twice, verbatim" light/dark
 * pattern; and the hue they resolve to is distinct from every one of the
 * five priority hues, in each theme. Contrast is recorded by hand per tasks
 * 13.2, not asserted here — this suite has no way to render real color.
 */

const RECURRING_TOKENS = [
  '--recurring-marker',
  '--recurring-bg',
  '--recurring-fg',
] as const

/** tokens.css declares its light palette once, then its dark overrides
 * twice, verbatim, in this fixed order (see the file's own header comment).
 * Splitting on those two markers isolates each of the three blocks without
 * depending on brace-counting or property order within a block. */
function themeBlocks(tokensCss: string): {
  light: string
  mediaDark: string
  explicitDark: string
} {
  // Both markers also appear, without a trailing `{`, inside this file's
  // own header comment describing the three-state pattern (see
  // tokens.css's opening doc comment) — appending the brace targets the
  // actual rule opening, not that prose mention of it.
  const mediaMarker = '@media (prefers-color-scheme: dark) {'
  const explicitMarker = ":root[data-theme='dark'] {"

  const [light, afterMedia] = tokensCss.split(mediaMarker)
  const [mediaDark, afterExplicit] = afterMedia.split(explicitMarker)
  return {
    light,
    mediaDark,
    explicitDark: explicitMarker + afterExplicit,
  }
}

function oklchOf(block: string, token: string): [number, number, number] {
  const pattern = new RegExp(
    `${token}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`,
  )
  const match = block.match(pattern)
  if (!match) {
    throw new Error(`${token} not declared in this block`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function allPriorityMarkerHues(block: string): number[] {
  const matches = block.matchAll(
    /--priority-[\w-]+-marker:\s*oklch\([\d.]+\s+[\d.]+\s+([\d.]+)\)/g,
  )
  return [...matches].map((match) => Number(match[1]))
}

/** The closest angular distance between two hues on the 360° hue circle. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

function ruleBodyFor(css: string, selector: string): string {
  const start = css.indexOf(selector)
  if (start === -1) {
    throw new Error(`selector "${selector}" not found`)
  }
  const braceStart = css.indexOf('{', start)
  const braceEnd = css.indexOf('}', braceStart)
  return css.slice(braceStart, braceEnd)
}

describe('the recurring color token is declared for both themes (13.1, 13.2)', () => {
  const { light, mediaDark, explicitDark } = themeBlocks(tokensCss)

  it('declares all three recurring tokens in the light block, the media-query dark block, and the explicit dark block', () => {
    for (const token of RECURRING_TOKENS) {
      expect(light, `light block missing ${token}`).toContain(`${token}:`)
      expect(mediaDark, `media-dark block missing ${token}`).toContain(
        `${token}:`,
      )
      expect(explicitDark, `explicit-dark block missing ${token}`).toContain(
        `${token}:`,
      )
    }
  })

  it('declares identical dark values in the media-query block and the explicit-theme block', () => {
    for (const token of RECURRING_TOKENS) {
      const mediaValue = oklchOf(mediaDark, token)
      const explicitValue = oklchOf(explicitDark, token)
      expect(explicitValue).toEqual(mediaValue)
    }
  })

  it('is distinct in hue from every one of the five priority tokens, in both themes', () => {
    const [, , recurringHueLight] = oklchOf(light, '--recurring-marker')
    const [, , recurringHueDark] = oklchOf(mediaDark, '--recurring-marker')

    const priorityHuesLight = allPriorityMarkerHues(light)
    const priorityHuesDark = allPriorityMarkerHues(mediaDark)

    expect(priorityHuesLight.length).toBe(5)
    expect(priorityHuesDark.length).toBe(5)

    // A hue within 30 degrees of an existing priority color would read as a
    // shade of that color rather than a color of its own — this is a
    // deliberate margin, not just an inequality check.
    for (const hue of priorityHuesLight) {
      expect(hueDistance(recurringHueLight, hue)).toBeGreaterThanOrEqual(30)
    }
    for (const hue of priorityHuesDark) {
      expect(hueDistance(recurringHueDark, hue)).toBeGreaterThanOrEqual(30)
    }
  })
})

describe('the recurring color token is used consistently across all three surfaces (13.1)', () => {
  it("the task row's recurrence badge uses the shared recurring tokens, not the neutral placeholders", () => {
    const rule = ruleBodyFor(taskItemCss, '.task-row__recurrence {')
    expect(rule).toContain('var(--recurring-bg)')
    expect(rule).toContain('var(--recurring-fg)')
    expect(rule).not.toContain('var(--surface-2)')
    expect(rule).not.toContain('var(--text-muted)')
  })

  it("the Recurring group heading's marker uses the shared recurring marker token, not the neutral placeholder", () => {
    const rule = ruleBodyFor(
      priorityGroupsCss,
      ".priority-group__marker[data-priority='recurring']",
    )
    expect(rule).toContain('var(--recurring-marker)')
    expect(rule).not.toContain('var(--text-muted)')
  })

  it('the recurring choice in the form uses the same shared recurring tokens once selected', () => {
    const rule = ruleBodyFor(
      taskFormCss,
      ".task-form__chip--recurring[aria-pressed='true']",
    )
    expect(rule).toContain('var(--recurring-marker)')
    expect(rule).toContain('var(--recurring-bg)')
    expect(rule).toContain('var(--recurring-fg)')
  })

  it('the Recurring type button in the rendered form is the element the CSS rule above actually targets', () => {
    const onSubmit = async () => ({ ok: true as const })
    render(
      <TaskForm
        heading="Add a task"
        submitLabel="Add task"
        onSubmit={onSubmit}
      />,
    )
    const typeGroup = screen.getByRole('group', { name: 'Type' })
    const recurringButton = within(typeGroup).getByRole('button', {
      name: 'Recurring',
    })
    const oneOffButton = within(typeGroup).getByRole('button', {
      name: 'One-off',
    })

    // Only the Recurring choice carries the modifier class the CSS above
    // selects on; One-off stays on the plain neutral/accent chip styling
    // every other toggle in the form uses.
    expect(recurringButton.className).toContain('task-form__chip--recurring')
    expect(oneOffButton.className).not.toContain('task-form__chip--recurring')

    fireEvent.click(recurringButton)
    expect(recurringButton.getAttribute('aria-pressed')).toBe('true')
  })
})
