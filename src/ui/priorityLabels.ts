import type { Priority } from '../domain/priority'

/**
 * Display label for each priority level (see
 * specs/task-management/spec.md, "Five priority levels with a defined
 * order"). Shared by the create/edit form's priority buttons and by every
 * task display, so a priority always reads the same way everywhere it
 * appears.
 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  'very-low': 'Very low',
}
