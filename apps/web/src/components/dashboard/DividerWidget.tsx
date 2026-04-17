import { X, Pencil } from 'lucide-react'
import type { Widget } from '@/types/api'

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
}

export function DividerWidget({ widget, onEdit, onDelete }: Props) {
  const color = widget.viz_config?.color ?? 'rgba(99,87,232,0.2)'

  return (
    <div className="group h-full flex items-center px-2 relative">
      {widget.title ? (
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px" style={{ background: color }} />
          <span
            className="text-xs font-bold uppercase tracking-widest whitespace-nowrap shrink-0"
            style={{ color }}
          >
            {widget.title}
          </span>
          <div className="flex-1 h-px" style={{ background: color }} />
        </div>
      ) : (
        <div className="w-full h-px" style={{ background: color }} />
      )}

      {/* Edit / delete on hover */}
      {(onEdit || onDelete) && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-black/10"
              style={{ color: 'rgba(99,87,232,0.6)' }}
              title="Edit"
            >
              <Pencil size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
              style={{ color: 'rgba(99,87,232,0.4)' }}
              title="Delete"
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
