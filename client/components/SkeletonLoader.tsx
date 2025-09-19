import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width, 
  height, 
  rounded = true 
}) => {
  const style: React.CSSProperties = {}
  
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={` bg-gray-200 ${rounded ? 'rounded' : ''} ${className}`}
      style={style}
    />
  )
}

// Card Skeleton
export const CardSkeleton: React.FC = () => (
  <div className="card ">
    <div className="flex items-center space-x-4 mb-4">
      <Skeleton width={48} height={48} className="rounded-full" />
      <div className="flex-1">
        <Skeleton height={20} className="mb-2" />
        <Skeleton height={16} width="60%" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton height={16} />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="40%" />
    </div>
  </div>
)

// Table Skeleton
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="card">
    <div className="overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <Skeleton height={16} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-6 py-4">
                  <Skeleton height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

// Stats Card Skeleton
export const StatCardSkeleton: React.FC = () => (
  <div className="card-stats ">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Skeleton height={16} width="40%" className="mb-2" />
        <Skeleton height={32} width="60%" className="mb-1" />
        <Skeleton height={14} width="30%" />
      </div>
      <Skeleton width={48} height={48} className="rounded-lg" />
    </div>
  </div>
)

// Dashboard Skeleton
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton height={32} width={200} className="mb-2" />
        <Skeleton height={16} width={300} />
      </div>
      <Skeleton width={120} height={40} className="rounded-lg" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSkeleton />
      <CardSkeleton />
    </div>

    {/* Recent Activity */}
    <CardSkeleton />
  </div>
)

// Form Skeleton
export const FormSkeleton: React.FC = () => (
  <div className="card ">
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton height={16} width="25%" />
          <Skeleton height={40} className="rounded-lg" />
        </div>
      ))}
      <div className="flex justify-end space-x-3">
        <Skeleton width={80} height={40} className="rounded-lg" />
        <Skeleton width={100} height={40} className="rounded-lg" />
      </div>
    </div>
  </div>
)

// List Skeleton
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="card ">
        <div className="flex items-center space-x-4">
          <Skeleton width={40} height={40} className="rounded-full" />
          <div className="flex-1">
            <Skeleton height={18} className="mb-2" />
            <Skeleton height={14} width="70%" />
          </div>
          <Skeleton width={60} height={32} className="rounded-lg" />
        </div>
      </div>
    ))}
  </div>
)

export default Skeleton
