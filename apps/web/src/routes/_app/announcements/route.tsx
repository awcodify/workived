import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { Plus, Pin, PinOff, Send, Trash2, Pencil, Megaphone, X, ChevronRight, ChevronDown } from 'lucide-react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { AnnouncementModal } from '@/components/workived/announcements/AnnouncementModal'
import {
  useAnnouncements,
  useAnnouncementsAdmin,
  useDeleteAnnouncement,
  usePublishAnnouncement,
  usePinAnnouncement,
  useMarkAnnouncementRead,
} from '@/lib/hooks/useAnnouncements'
import { useCanEditOrgSettings } from '@/lib/hooks/useRole'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import type { Announcement } from '@/types/api'

const t = moduleThemes.announcements

export const Route = createFileRoute('/_app/announcements')({
  component: AnnouncementsPage,
})

export function AnnouncementsPage() {
  const isAdmin = useCanEditOrgSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | undefined>()
  const [viewing, setViewing] = useState<Announcement | undefined>()
  const [showDrafts, setShowDrafts] = useState(false)

  const { data: feed = [], isLoading: feedLoading } = useAnnouncements()
  const { data: all = [], isLoading: adminLoading } = useAnnouncementsAdmin()

  const deleteMut = useDeleteAnnouncement()
  const publishMut = usePublishAnnouncement()
  const pinMut = usePinAnnouncement()
  const markReadMut = useMarkAnnouncementRead()

  // For admins, get draft announcements
  const drafts = isAdmin ? all.filter((a) => !a.published_at) : []

  function openAnnouncement(ann: Announcement) {
    if (!ann.is_read) markReadMut.mutate(ann.id)
    setViewing(ann)
  }

  return (
    <div
      data-testid="announcements-page"
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.announcements, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: t.text,
              lineHeight: typography.display.lineHeight,
            }}
          >
            Announcements
          </h1>
          <div className="flex items-center gap-3">
            <DateTime textColor={t.text} textMutedColor={t.textMuted} borderColor={t.border} />
            <NotificationBell
              surfaceColor={t.surface}
              borderColor={t.border}
              accentColor={colors.accent}
              textColor={t.text}
              textMutedColor={t.textMuted}
            />
          </div>
        </div>

        {/* New button */}
        {isAdmin && (
          <div className="flex justify-end mt-5">
            <button
              data-testid="announcements-new-btn"
              onClick={() => { setEditing(undefined); setModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: t.accent, color: t.accentText }}
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Drafts section (admin only) */}
        {isAdmin && drafts.length > 0 && (
          <div className="mb-6">
            <button
              data-testid="announcements-drafts-toggle"
              onClick={() => setShowDrafts(!showDrafts)}
              className="flex items-center gap-2 mb-3 text-sm font-semibold transition-colors"
              style={{ color: t.textMuted }}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showDrafts ? '' : '-rotate-90'}`}
              />
              Drafts ({drafts.length})
            </button>
            {showDrafts && (
              <div className="space-y-3">
                {drafts.map((ann) => (
                  <AnnouncementCard
                    key={ann.id}
                    ann={ann}
                    isAdmin={isAdmin}
                    onView={() => openAnnouncement(ann)}
                    onEdit={() => { setEditing(ann); setModalOpen(true) }}
                    onDelete={() => deleteMut.mutate(ann.id)}
                    onPublish={() => publishMut.mutate(ann.id)}
                    onPin={() => pinMut.mutate({ id: ann.id, pin: !ann.is_pinned })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Published announcements */}
        {feedLoading && (
          <div data-testid="announcements-skeleton" className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-black/5 animate-pulse" />
            ))}
          </div>
        )}

        {!feedLoading && feed.length === 0 && (
          <div data-testid="announcements-empty" className="text-center py-24" style={{ color: t.textMuted }}>
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No announcements yet</p>
          </div>
        )}

        {feed.map((ann) => (
          <AnnouncementCard
            key={ann.id}
            ann={ann}
            isAdmin={isAdmin}
            onView={() => openAnnouncement(ann)}
            onEdit={() => { setEditing(ann); setModalOpen(true) }}
            onDelete={() => deleteMut.mutate(ann.id)}
            onPublish={() => publishMut.mutate(ann.id)}
            onPin={() => pinMut.mutate({ id: ann.id, pin: !ann.is_pinned })}
          />
        ))}
      </div>

      {/* Detail view modal */}
      {viewing && (
        <AnnouncementDetailModal ann={viewing} onClose={() => setViewing(undefined)} />
      )}

      {modalOpen && (
        <AnnouncementModal
          announcement={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function AnnouncementCard({
  ann,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onPublish,
  onPin,
}: {
  ann: Announcement
  isAdmin?: boolean
  onView: () => void
  onEdit?: () => void
  onDelete?: () => void
  onPublish?: () => void
  onPin?: () => void
}) {
  const date = ann.published_at
    ? new Date(ann.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const isDraft = !ann.published_at

  return (
    <div
      data-testid={`announcement-row-${ann.id}`}
      className="group rounded-2xl transition-all hover:shadow-md relative"
      style={{
        background: t.surface,
        border: ann.is_pinned ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
        opacity: ann.is_read && !isDraft ? 0.75 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onView}
        >
          {ann.is_pinned && (
            <div
              className="flex items-center gap-1.5 mb-2 text-xs font-bold"
              style={{ color: t.accent }}
            >
              <Pin className="w-3 h-3" />
              Pinned
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            {isDraft && isAdmin && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.06)', color: t.textMuted }}
              >
                Draft
              </span>
            )}
            <h3 className="font-bold text-sm" style={{ color: t.text }}>{ann.title}</h3>
            {!ann.is_read && !isDraft && (
              <span
                data-testid={`announcement-unread-dot-${ann.id}`}
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: colors.accent }}
              />
            )}
          </div>
          <p className="text-sm line-clamp-2" style={{ color: t.textMuted }}>{ann.body}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs font-medium" style={{ color: t.textMuted }}>{ann.author_name}</span>
            {date && <span className="text-xs" style={{ color: t.textMuted }}>{date}</span>}
          </div>
        </div>
        
        {isAdmin ? (
          <div className="flex items-center gap-1 shrink-0">
            {isDraft && onPublish && (
              <button
                data-testid={`announcement-publish-btn-${ann.id}`}
                onClick={onPublish}
                title="Publish"
                className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
            {onPin && (
              <button
                data-testid={`announcement-pin-btn-${ann.id}`}
                onClick={onPin}
                title={ann.is_pinned ? 'Unpin' : 'Pin'}
                className="p-2 rounded-lg transition-colors"
                style={{ color: t.accent }}
              >
                {ann.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}
            {onEdit && (
              <button
                data-testid={`announcement-edit-btn-${ann.id}`}
                onClick={onEdit}
                title="Edit"
                className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                data-testid={`announcement-delete-btn-${ann.id}`}
                onClick={onDelete}
                title="Delete"
                className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <ChevronRight
            className="w-4 h-4 shrink-0 mt-0.5 opacity-30 group-hover:opacity-60 transition-opacity cursor-pointer"
            style={{ color: t.text }}
            onClick={onView}
          />
        )}
      </div>
    </div>
  )
}

function AnnouncementDetailModal({ ann, onClose }: { ann: Announcement; onClose: () => void }) {
  const date = ann.published_at
    ? new Date(ann.published_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      data-testid="announcement-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        {/* Modal header */}
        <div
          className="flex items-start justify-between gap-4 px-6 pt-6 pb-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <div className="flex-1 min-w-0">
            {ann.is_pinned && (
              <div className="flex items-center gap-1 text-xs font-bold mb-2" style={{ color: t.accent }}>
                <Pin className="w-3 h-3" />
                Pinned
              </div>
            )}
            <h2 className="font-extrabold text-lg leading-tight" style={{ color: t.text }}>{ann.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-medium" style={{ color: t.textMuted }}>{ann.author_name}</span>
              {date && (
                <>
                  <span className="text-xs" style={{ color: t.border }}>·</span>
                  <span className="text-xs" style={{ color: t.textMuted }}>{date}</span>
                </>
              )}
            </div>
          </div>
          <button
            data-testid="announcement-detail-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: t.textMuted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>{ann.body}</p>
        </div>
      </div>
    </div>
  )
}
