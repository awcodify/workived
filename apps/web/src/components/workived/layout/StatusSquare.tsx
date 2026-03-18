import { statusConfig, type StatusKey } from '@/design/tokens'

interface StatusSquareProps {
  status: string
}

export function StatusSquare({ status }: StatusSquareProps) {
  const cfg = statusConfig[status as StatusKey] ?? { color: '#B0AEBE', label: status }

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: cfg.color }}
    >
      <span
        className="w-[7px] h-[7px] flex-shrink-0"
        style={{ background: cfg.color, borderRadius: 2 }}
      />
      {cfg.label}
    </span>
  )
}
