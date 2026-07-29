import React from 'react'

export interface ActionToolbarProps {
  children: React.ReactNode
  className?: string
}

export default function ActionToolbar({ children, className = '' }: ActionToolbarProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {children}
    </div>
  )
}
