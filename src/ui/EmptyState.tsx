import './EmptyState.css'

/**
 * The single-word empty-state marker shared by every tab (see design.md,
 * decision 10: "Every empty state uses the single word 'empty'" — the tabs
 * are empty for different reasons, and inventing distinct copy for each
 * would put three strings in the product that nobody decided on).
 */
export function EmptyState() {
  return <p className="empty-state">empty</p>
}
