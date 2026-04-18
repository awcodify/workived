import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { announcementsApi } from '@/lib/api/announcements'
import type { CreateAnnouncementRequest, UpdateAnnouncementRequest } from '@/types/api'

export const announcementKeys = {
  all: ['announcements'] as const,
  list: () => [...announcementKeys.all, 'list'] as const,
  listAdmin: () => [...announcementKeys.all, 'admin'] as const,
  unreadCount: () => [...announcementKeys.all, 'unread-count'] as const,
}

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.list(),
    queryFn: () => announcementsApi.list().then((r) => r.data.data),
    staleTime: 60_000,
  })
}

export function useAnnouncementsAdmin() {
  return useQuery({
    queryKey: announcementKeys.listAdmin(),
    queryFn: () => announcementsApi.listAdmin().then((r) => r.data.data),
    staleTime: 30_000,
  })
}

export function useAnnouncementUnreadCount() {
  return useQuery({
    queryKey: announcementKeys.unreadCount(),
    queryFn: () => announcementsApi.unreadCount().then((r) => r.data.data.count),
    staleTime: 30_000,
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAnnouncementRequest) =>
      announcementsApi.create(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.all })
      toast.success('Announcement created')
    },
    onError: () => {
      toast.error('Failed to create announcement')
    },
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAnnouncementRequest }) =>
      announcementsApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.all })
      toast.success('Announcement updated')
    },
    onError: () => {
      toast.error('Failed to update announcement')
    },
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.all })
      toast.success('Announcement deleted')
    },
    onError: () => {
      toast.error('Failed to delete announcement')
    },
  })
}

export function usePublishAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => announcementsApi.publish(id).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.all })
      toast.success('Announcement published')
    },
    onError: () => {
      toast.error('Failed to publish announcement')
    },
  })
}

export function usePinAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: boolean }) =>
      (pin ? announcementsApi.pin(id) : announcementsApi.unpin(id)).then((r) => r.data.data),
    onSuccess: (_data, { pin }) => {
      qc.invalidateQueries({ queryKey: announcementKeys.all })
      toast.success(pin ? 'Pinned' : 'Unpinned')
    },
    onError: () => {
      toast.error('Failed to update pin')
    },
  })
}

export function useMarkAnnouncementRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => announcementsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.unreadCount() })
      qc.invalidateQueries({ queryKey: announcementKeys.list() })
    },
  })
}
