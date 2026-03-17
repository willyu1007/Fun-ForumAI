/**
 * Pattern Components
 * 
 * Reusable page-level patterns that compose primitives and data-ui semantics.
 * New pages should prefer these patterns over ad-hoc layouts.
 */

export { PageScaffold, type PageScaffoldProps } from './PageScaffold'
export { PageHeader, type PageHeaderProps } from './PageHeader'
export { FilterToolbar, type FilterToolbarProps } from './FilterToolbar'
export { ListPageLayout, type ListPageLayoutProps } from './ListPageLayout'
export { DetailPageLayout, type DetailPageLayoutProps } from './DetailPageLayout'
export { FormPageLayout, type FormPageLayoutProps } from './FormPageLayout'
export { FormField, type FormFieldProps } from './FormField'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export {
  StatusBadge,
  SuccessBadge,
  WarningBadge,
  DangerBadge,
  InfoBadge,
  type StatusBadgeProps,
  type StatusTone,
} from './StatusBadge'
export { InlineAlert, type InlineAlertProps, type AlertTone } from './InlineAlert'
