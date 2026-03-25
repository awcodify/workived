import { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, className = '', style = {} }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'rgba(0, 0, 0, 0.08)',
        ...style,
      }}
    />
  )
}

// Card skeleton for request items
export function RequestSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderBottom: isLast ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <Skeleton width={40} height={40} borderRadius={10} />
        <div className="flex-1 space-y-2">
          {/* Name */}
          <Skeleton width="40%" height={14} />
          {/* Date range */}
          <Skeleton width="60%" height={12} />
          {/* Description */}
          <Skeleton width="80%" height={10} />
        </div>
        {/* Status badge */}
        <Skeleton width={70} height={24} borderRadius={6} />
      </div>
    </div>
  )
}

// Table skeleton for multiple request items
export function RequestTableSkeleton({ count = 3, surfaceColor = '#FFFFFF', borderColor = '#E5E7EB' }: { count?: number; surfaceColor?: string; borderColor?: string }) {
  return (
    <div
      style={{
        background: surfaceColor,
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <RequestSkeleton key={idx} isLast={idx === count - 1} />
      ))}
    </div>
  )
}

// Balance card skeleton
export function BalanceCardSkeleton({ surfaceColor = '#FFFFFF', borderColor = '#E5E7EB' }: { surfaceColor?: string; borderColor?: string }) {
  return (
    <div
      style={{
        background: surfaceColor,
        borderRadius: 18,
        border: `1px solid ${borderColor}`,
        padding: '28px',
      }}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton width={120} height={20} />
          <Skeleton width={60} height={14} />
        </div>
        {/* Big number */}
        <Skeleton width={100} height={44} />
        {/* Progress bar */}
        <Skeleton width="100%" height={8} borderRadius={4} />
        {/* Stats */}
        <div className="flex justify-between">
          <Skeleton width={80} height={12} />
          <Skeleton width={80} height={12} />
          <Skeleton width={80} height={12} />
        </div>
      </div>
    </div>
  )
}

// Team member row skeleton
export function TeamMemberSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton width={36} height={36} borderRadius={10} />
      <div className="flex-1 space-y-1">
        <Skeleton width="50%" height={14} />
        <Skeleton width="70%" height={10} />
      </div>
      <Skeleton width={60} height={20} borderRadius={10} />
    </div>
  )
}

// Generic list skeleton
export function ListSkeleton({ count = 3, itemHeight = 60 }: { count?: number; itemHeight?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} width="100%" height={itemHeight} borderRadius={12} />
      ))}
    </div>
  )
}
