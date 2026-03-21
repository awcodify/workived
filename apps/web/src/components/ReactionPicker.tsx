import { useState } from 'react'
import { typography } from '@/design/tokens'
import type { CommentReactionSummary } from '@/types/api'

const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

interface ReactionPickerProps {
  reactions: CommentReactionSummary[]
  onToggle: (emoji: string) => void
  isLoading?: boolean
}

export function ReactionPicker({
  reactions,
  onToggle,
  isLoading = false,
}: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false)

  // Merge backend reactions with available emojis
  const reactionMap = new Map(reactions.map((r) => [r.emoji, r]))

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {/* Show reactions with counts */}
      {reactions
        .filter((r) => r.count > 0)
        .map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => onToggle(reaction.emoji)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all hover:scale-110 disabled:opacity-50"
            style={{
              background: reaction.user_reacted ? 'rgba(99, 87, 232, 0.15)' : 'rgba(0, 0, 0, 0.05)',
              border: reaction.user_reacted ? '1.5px solid #6357E8' : '1.5px solid rgba(0, 0, 0, 0.1)',
              color: reaction.user_reacted ? '#6357E8' : '#64748B',
              fontFamily: typography.fontFamily,
            }}
            title={
              reaction.user_reacted
                ? 'You reacted with this'
                : `${reaction.count} ${reaction.count === 1 ? 'person' : 'people'} reacted`
            }
          >
            <span className="text-sm">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          disabled={isLoading}
          className="flex items-center justify-center w-7 h-7 rounded-full text-sm transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: showPicker ? 'rgba(99, 87, 232, 0.08)' : 'rgba(0, 0, 0, 0.03)',
            border: showPicker
              ? '1.5px solid rgba(99, 87, 232, 0.3)'
              : '1.5px solid rgba(0, 0, 0, 0.08)',
            color: '#64748B',
          }}
          title="Add reaction"
        >
          {showPicker ? '✕' : '😊'}
        </button>

        {/* Emoji picker popover */}
        {showPicker && (
          <div
            className="absolute bottom-full mb-2 left-0 p-2 rounded-lg shadow-lg z-10 flex gap-1"
            style={{
              background: '#FFFFFF',
              border: '2px solid rgba(0, 0, 0, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {AVAILABLE_EMOJIS.map((emoji) => {
              const existing = reactionMap.get(emoji)
              const isReacted = existing?.user_reacted || false

              return (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggle(emoji)
                    setShowPicker(false)
                  }}
                  disabled={isLoading}
                  className="flex items-center justify-center w-8 h-8 rounded transition-all hover:scale-125 disabled:opacity-50"
                  style={{
                    background: isReacted ? 'rgba(99, 87, 232, 0.15)' : 'transparent',
                  }}
                  title={isReacted ? 'Remove reaction' : 'Add reaction'}
                >
                  <span className="text-lg">{emoji}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
