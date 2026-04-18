import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useCreateAnnouncement, useUpdateAnnouncement } from '@/lib/hooks/useAnnouncements'
import type { Announcement } from '@/types/api'

const schema = z.object({
  title: z.string().min(1, 'Title required').max(255),
  body: z.string().min(1, 'Body required'),
  is_pinned: z.boolean().optional(),
  publish: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  announcement?: Announcement
  onClose: () => void
}

export function AnnouncementModal({ announcement, onClose }: Props) {
  const isEdit = !!announcement
  const createMut = useCreateAnnouncement()
  const updateMut = useUpdateAnnouncement()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: announcement?.title ?? '',
      body: announcement?.body ?? '',
      is_pinned: announcement?.is_pinned ?? false,
      publish: false,
    },
  })

  async function onSubmit(data: FormData) {
    if (isEdit) {
      await updateMut.mutateAsync({ id: announcement.id, data })
    } else {
      await createMut.mutateAsync(data)
    }
    onClose()
  }

  return (
    <div
      data-testid="announcement-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="font-bold text-base">
            {isEdit ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            data-testid="announcement-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          data-testid="announcement-form"
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Title
            </label>
            <input
              data-testid="announcement-title-input"
              {...register('title')}
              placeholder="e.g. Office closed on Friday"
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Body
            </label>
            <textarea
              data-testid="announcement-body-input"
              {...register('body')}
              rows={5}
              placeholder="Write your announcement..."
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
            {errors.body && (
              <p className="text-xs text-red-500 mt-1">{errors.body.message}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                data-testid="announcement-pinned-checkbox"
                type="checkbox"
                {...register('is_pinned')}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium">Pin to top</span>
            </label>

            {!isEdit && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid="announcement-publish-checkbox"
                  type="checkbox"
                  {...register('publish')}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">Publish now</span>
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="announcement-cancel-btn"
              className="flex-1 py-2.5 rounded-xl border border-black/10 text-sm font-semibold hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="announcement-submit-btn"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#6357E8] text-white text-sm font-semibold hover:bg-[#4A3FBF] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
