import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { Plus, Pin, PinOff, Send, Trash2, Pencil, Megaphone, X, ChevronRight } from 'lucide-react'
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

type ViewTab = 'feed' | 'manage'

export function AnnouncementsPage() {
  const isAdmin = useCanEditOrgSettings()
  const [tab, setTab] = useState<ViewTab>('feed')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | undefined>()
  const [viewing, setViewing] = useState<Announcement | undefined>()

  const { data: feed = [], isLoading: feedLoading } = useAnnouncements()
  const { data: all = [], isLoading: adminLoading } = useAnnouncementsAdmin()

  const deleteMut = useDeleteAnnouncement()
  const publishMut = usePublishAnnouncement()
  const pinMut = usePinAnnouncement()
  const markReadMut = useMarkAnnouncementRead()

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

        {/* Tabs + New button on same row */}
        <div className="flex items-center justify-between mt-5">
          {isAdmin ? (
            <div className="flex gap-2">
              <button
                data-testid="announcements-tab-feed"
                onClick={() => setTab('feed')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={tab === 'feed' ? { background: t.accent, color: t.accentText } : { background: 'rgba(0,0,0,0.06)', color: t.textMuted }}
              >
                Employee view
              </button>
              <button
                data-testid="announcements-tab-manage"
                onClick={() => setTab('manage')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={tab === 'manage' ? { background: t.accent, color: t.accentText } : { background: 'rgba(0,0,0,0.06)', color: t.textMuted }}
              >
                Manage
              </button>
            </div>
          ) : (
            <div />
          )}
          {isAdmin && (
            <button
              data-testid="announcements-new-btn"
              onClick={() => { setEditing(undefined); setModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: t.accent, color: t.accentText }}
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>
      </div>

      {/* Content — full width */}
      <div className="space-y-3">
        {tab === 'feed' ? (
          <>
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
                onClick={() => openAnnouncement(ann)}
              />
            ))}
          </>
        ) : (
          <>
            {adminLoading && (
              <div data-testid="announcements-admin-skeleton" className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-black/5 animate-pulse" />
                ))}
              </div>
            )}

            {!adminLoading && all.length === 0 && (
              <div data-testid="announcements-admin-empty" className="text-center py-24" style={{ color: t.textMuted }}>
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No announcements yet.</p>
              </div>
            )}

            {all.map((ann) => (
              <AdminAnnouncementRow
                key={ann.id}
                ann={ann}
                onEdit={() => { setEditing(ann); setModalOpen(true) }}
                onDelete={() => deleteMut.mutate(ann.id)}
                onPublish={() => publishMut.mutate(ann.id)}
                onPin={() => pinMut.mutate({ id: ann.id, pin: !ann.is_pinned })}
              />
            ))}
          </>
        )}
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

function AnnouncementCard({ ann, onClick }: { ann: Announcement; onClick: () => void }) {
  const date = ann.published_at
    ? new Date(ann.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      data-testid={`announcement-row-${ann.id}`}
      onClick={onClick}
      className="group rounded-2xl cursor-pointer transition-all hover:shadow-md"
      style={{
        background: t.surface,
        border: ann.is_pinned ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
        opacity: ann.is_read ? 0.75 : 1,
      }}
    >
      {ann.is_pinned && (
        <div
          className="flex items-center gap-1.5 px-5 pt-3 pb-0 text-xs font-bold"
          style={{ color: t.accent }}
        >
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm" style={{ color: t.text }}>{ann.title}</h3>
            {!ann.is_read && (
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
        <ChevronRight
          className="w-4 h-4 shrink-0 mt-0.5 opacity-30 group-hover:opacity-60 transition-opacity"
          style={{ color: t.text }}
        />
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

function AdminAnnouncementRow({
  ann,
  onEdit,
  onDelete,
  onPublish,
  onPin,
}: {
  ann: Announcement
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onPin: () => void
}) {
  const isDraft = !ann.published_at

  return (
    <div
      data-testid={`announcement-admin-row-${ann.id}`}
      className="rounded-2xl"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {isDraft ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.06)', color: t.textMuted }}>Draft</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-100 text-green-700">Published</span>
            )}
            {ann.is_pinned && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `rgba(180,80,20,0.10)`, color: t.accent }}>Pinned</span>
            )}
          </div>
          <h3 className="font-bold text-sm" style={{ color: t.text }}>{ann.title}</h3>
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: t.textMuted }}>{ann.body}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isDraft && (
            <button
              data-testid={`announcement-publish-btn-${ann.id}`}
              onClick={onPublish}
              title="Publish"
              className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            data-testid={`announcement-pin-btn-${ann.id}`}
            onClick={onPin}
            title={ann.is_pinned ? 'Unpin' : 'Pin'}
            className="p-2 rounded-lg transition-colors"
            style={{ color: t.accent }}
          >
            {ann.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            data-testid={`announcement-edit-btn-${ann.id}`}
            onClick={onEdit}
            title="Edit"
            className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid={`announcement-delete-btn-${ann.id}`}
            onClick={onDelete}
            title="Delete"
            className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
