import type { ReactNode, SVGProps } from 'react'

/**
 * The application's icon set (see design.md, decision 14): plain inline
 * SVG, one module, no icon package and no sprite sheet to keep in sync.
 *
 * Every icon here is purely decorative - `aria-hidden="true"` and
 * `focusable="false"` - because its accessible name always comes from the
 * `aria-label` (or the visible text) of the control that encloses it, per
 * specs/task-management/spec.md, "Editing and deleting are named controls
 * on every task row". Swapping text for an icon must never remove that
 * name; every caller of these components keeps its existing `aria-label`.
 */
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** The light theme's icon on the theme toggle. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.13 2.13M17.65 17.65l2.13 2.13M2 12h3M19 12h3M4.22 19.78l2.13-2.13M17.65 6.35l2.13-2.13" />
    </Icon>
  )
}

/** The dark theme's icon on the theme toggle. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Icon>
  )
}

/** The "Edit" control on a task row. */
export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z" />
      <path d="M14 6l4 4" />
    </Icon>
  )
}

/** The "Delete" control on a task row. */
export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  )
}

/** The "Recalculate today" action. */
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
      <path d="M3 16v4h4" />
      <path d="M21 8V4h-4" />
    </Icon>
  )
}

/** The persistent add-task control. */
export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

/** Exported for parity with the mockup's icon set (design.md, decision 14);
 * not currently wired to a control of its own - Escape, the backdrop, and
 * "Cancel" already dismiss the creation sheet, and adding a redundant close
 * button would be a new interactive control this section's scope excludes. */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}
