/**
 * Pattern Components
 * 
 * Reusable page-level patterns that compose primitives and data-ui semantics.
 * New pages should prefer these patterns over ad-hoc layouts.
 */

export { PageScaffold, type PageScaffoldProps } from './PageScaffold.js'
export { PageHeader, type PageHeaderProps } from './PageHeader.js'
export { FilterToolbar, type FilterToolbarProps } from './FilterToolbar.js'
export { ListPageLayout, type ListPageLayoutProps } from './ListPageLayout.js'
export { DetailPageLayout, type DetailPageLayoutProps } from './DetailPageLayout.js'
export { FormPageLayout, type FormPageLayoutProps } from './FormPageLayout.js'
export { FormField, type FormFieldProps } from './FormField.js'
export { EmptyState, type EmptyStateProps } from './EmptyState.js'
export {
  StatusBadge,
  SuccessBadge,
  WarningBadge,
  DangerBadge,
  InfoBadge,
  type StatusBadgeProps,
  type StatusTone,
} from './StatusBadge.js'
export { InlineAlert, type InlineAlertProps, type AlertTone } from './InlineAlert.js'
