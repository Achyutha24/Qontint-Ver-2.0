/**
 * DomainGuard — Redirects unauthenticated/unconfigured users to "/" 
 * if no domain has been selected yet.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useDomain } from '../context/DomainContext'

export default function DomainGuard() {
  const { hasSelectedWorkspace } = useDomain()

  if (!hasSelectedWorkspace) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
