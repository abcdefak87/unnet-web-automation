import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  size = 'md'
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8 px-4',
      icon: 'w-12 h-12',
      title: 'text-base font-medium',
      description: 'text-sm',
      iconSize: 'w-6 h-6'
    },
    md: {
      container: 'py-12 px-6',
      icon: 'w-16 h-16',
      title: 'text-lg font-medium',
      description: 'text-sm',
      iconSize: 'w-8 h-8'
    },
    lg: {
      container: 'py-16 px-8',
      icon: 'w-20 h-20',
      title: 'text-xl font-medium',
      description: 'text-base',
      iconSize: 'w-10 h-10'
    }
  }

  const classes = sizeClasses[size]

  return (
    <div className={`empty-state ${classes.container}`}>
      <div className={`empty-state-icon ${classes.icon}`}>
        <Icon className={`${classes.iconSize} text-gray-400`} />
      </div>
      <h3 className={`empty-state-title ${classes.title}`}>
        {title}
      </h3>
      <p className={`empty-state-description ${classes.description}`}>
        {description}
      </p>
      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  )
}
