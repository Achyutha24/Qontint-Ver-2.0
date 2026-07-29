import AppLayout from '../../layouts/AppLayout'

export { default as PageContainer } from './PageContainer'
export { default as PageHeader } from './PageHeader'
export { default as ContentContainer } from './ContentContainer'
export { default as Breadcrumbs } from './Breadcrumbs'
export { default as StatusBar } from './StatusBar'
export { default as ActionToolbar } from './ActionToolbar'
export { default as ErrorBoundary } from './ErrorBoundary'
export { default as SkeletonLoader } from './SkeletonLoader'
export { default as EmptyState } from './EmptyState'

export default function ApplicationShell() {
  return <AppLayout />
}
