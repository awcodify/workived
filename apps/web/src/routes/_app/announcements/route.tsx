import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { Megaphone, Plus, Pin, PinOff, Send, Trash2, Pencil } from 'lucide-react'
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
import type { Announcement } from '@/types/api'

const BG = '#FFF8F0'

export const Route = createFileRoute('/_app/announcements')({
  component: AnnouncementsPage,
})

type ViewTab = 'feed' | 'manage'

export function AnnouncementsPage() {
  const isAdmin = useCanEditOrgSettings()
  const [tab, setTab] = useState<ViewTab>('feed')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | undefined>()

  const { data: feed = [], isLoading: feedLoading } = useAnnouncements()
  const { data: all = [], isLoading: adminLoading } = useAnnouncementsAdmin()

  const deleteMut = useDeleteAnnouncement()
  const publishMut = usePublishAnnouncement()
  const pinMut = usePinAnnouncement()
  const markReadMut = useMarkAnnouncementRead()

  return (
    <div
      data-testid="announcements-page"
      className="min-h-screen pb-32"
      style={{ background: BG }}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#B45014]" />
            <h1 className="font-bold text-lg text-gray-900">Announcements</h1>
          </div>
          <div className="flex items-center gap-2">
            <DateTime textColor="#2C3E50" textMutedColor="#7F8C8D" borderColor="rgba(0,0,0,0.08)" />
            <NotificationBell />
            {isAdmin && (
              <button
                data-testid="announcements-new-btn"
                onClick={() => { setEditing(undefined); setModalOpen(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6357E8] text-white text-xs font-semibold hover:bg-[#4A3FBF] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
            <button
              data-testid="announcements-tab-feed"
              onClick={() => setTab('feed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'feed' ? 'bg-[#B45014] text-white' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
            >
              Employee view
            </button>
            <button
              data-testid="announcements-tab-manage"
              onClick={() => setTab('manage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'manage' ? 'bg-[#B45014] text-white' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
            >
              Manage
            </button>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {tab === 'feed' ? (
          <>
            {feedLoading && (
              <div data-testid="announcements-skeleton" className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-black/5 animate-pulse" />
                ))}
              </div>
            )}

            {!feedLoading && feed.length === 0 && (
              <div data-testid="announcements-empty" className="text-center py-16 text-gray-400">
                <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No announcements yet</p>
              </div>
            )}

            {feed.map((ann) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                onRead={() => !ann.is_read && markReadMut.mutate(ann.id)}
              />
            ))}
          </>
        ) : (
          <>
            {adminLoading && (
              <div data-testid="announcements-admin-skeleton" className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-black/5 animate-pulse" />
                ))}
              </div>
            )}

            {!adminLoading && all.length === 0 && (
              <div data-testid="announcements-admin-empty" className="text-center py-16 text-gray-400">
                <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No announcements yet. Create one above.</p>
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

      {modalOpen && (
        <AnnouncementModal
          announcement={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function AnnouncementCard({ ann, onRead }: { ann: Announcement; onRead: () => void }) {
  const date = ann.published_at
    ? new Date(ann.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      data-testid={`announcement-row-${ann.id}`}
      onClick={onRead}
      className={`rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md ${ann.is_read ? 'bg-white/60' : 'bg-white shadow-sm'}`}
    >
      {ann.is_pinned && (
        <div className="flex items-center gap-1 text-[#B45014] text-xs font-semibold mb-2">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-sm mb-1 ${ann.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
            {ann.title}
            {!ann.is_read && (
              <span
                data-testid={`announcement-unread-dot-${ann.id}`}
                className="inline-block w-1.5 h-1.5 rounded-full bg-[#6357E8] ml-2 align-middle"
              />
            )}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2">{ann.body}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{ann.author_name}</span>
        {date && <span className="text-xs text-gray-400">{date}</span>}
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
      className="bg-white rounded-2xl p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDraft ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Draft</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-100 text-green-700">Published</span>
            )}
            {ann.is_pinned && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Pinned</span>
            )}
          </div>
          <h3 className="font-bold text-sm text-gray-900">{ann.title}</h3>
          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{ann.body}</p>
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
            className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 transition-colors"
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
