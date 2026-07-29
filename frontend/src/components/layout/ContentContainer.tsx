import React from 'react'

export interface ContentContainerProps {
  children: React.ReactNode
  className?: string
}

export default function ContentContainer({ children, className = '' }: ContentContainerProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  )
}
