import { X, Pencil } from 'lucide-react'
import type { Widget } from '@/types/api'

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
}

export function TextWidget({ widget, onEdit, onDelete }: Props) {
  const content = widget.viz_config?.content

  return (
    <div
      className="group h-full rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden"
      style={{ background: '#fff', border: '1px solid rgba(99,87,232,0.10)' }}
    >
      {widget.title && (
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(99,87,232,0.5)' }}>
          {widget.title}
        </p>
      )}
      <p className="text-sm leading-relaxed" style={{ color: '#3D3B52', whiteSpace: 'pre-wrap' }}>
        {content ?? ''}
      </p>

      {(onEdit || onDelete) && (
        <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-black/10"
              style={{ color: 'rgba(99,87,232,0.5)' }}
              title="Edit"
            >
              <Pencil size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
              style={{ color: 'rgba(99,87,232,0.3)' }}
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
