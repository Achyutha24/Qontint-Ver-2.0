import React from 'react'

export interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`max-w-[1536px] mx-auto px-4 sm:px-6 py-6 space-y-6 min-h-[calc(100vh-3.5rem)] ${className}`}>
      {children}
    </div>
  )
}
