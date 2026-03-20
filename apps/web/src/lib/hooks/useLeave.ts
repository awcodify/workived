import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveApi } from '@/lib/api/leave'
import type {
  CreatePolicyInput,
  UpdatePolicyInput,
  SubmitRequestInput,
} from '@/types/api'

// ── Query Keys ───────────────────────────────────────────────
export const leaveKeys = {
  all: ['leave'] as const,

  policies: () => [...leaveKeys.all, 'policies'] as const,

  balances: () => [...leaveKeys.all, 'balances'] as const,
  myBalances: (year?: number) => [...leaveKeys.balances(), 'me', year] as const,
  allBalances: (year?: number) => [...leaveKeys.balances(), 'all', year] as const,

  requests: () => [...leaveKeys.all, 'requests'] as const,
  myRequests: () => [...leaveKeys.requests(), 'me'] as const,
  allRequests: (params?: { status?: string; year?: number }) =>
    [...leaveKeys.requests(), 'all', params] as const,

  calendar: (year: number, month: number) =>
    [...leaveKeys.all, 'calendar', year, month] as const,
  holidays: (startDate: string, endDate: string) =>
    [...leaveKeys.all, 'holidays', startDate, endDate] as const,
}

// ── Policy Hooks ─────────────────────────────────────────────
export function usePolicies() {
  return useQuery({
    queryKey: leaveKeys.policies(),
    queryFn: () => leaveApi.listPolicies().then((r) => r.data.data),
    staleTime: 30 * 60 * 1000, // 30 min — policies rarely change
  })
}

export function useCreatePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePolicyInput) =>
      leaveApi.createPolicy(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.policies() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

export function useUpdatePolicy(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePolicyInput) =>
      leaveApi.updatePolicy(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.policies() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

export function useDeactivatePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leaveApi.deactivatePolicy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.policies() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

// ── Balance Hooks ────────────────────────────────────────────
export function useMyBalances(year?: number) {
  return useQuery({
    queryKey: leaveKeys.myBalances(year),
    queryFn: () => leaveApi.myBalances(year).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min — balances update on request approval
  })
}

export function useAllBalances(year?: number) {
  return useQuery({
    queryKey: leaveKeys.allBalances(year),
    queryFn: () => leaveApi.listBalances(year).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

// ── Request Hooks ────────────────────────────────────────────
export function useMyRequests() {
  return useQuery({
    queryKey: leaveKeys.myRequests(),
    queryFn: () => leaveApi.myRequests().then((r) => r.data.data),
    staleTime: 60 * 1000, // 1 min — requests change frequently
  })
}

export function useAllRequests(params?: { status?: string; year?: number }) {
  return useQuery({
    queryKey: leaveKeys.allRequests(params),
    queryFn: () => leaveApi.listRequests(params).then((r) => r.data.data),
    staleTime: 60 * 1000, // 1 min
  })
}

export function useSubmitRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitRequestInput) =>
      leaveApi.submitRequest(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.requests() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

export function useApproveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      leaveApi.approveRequest(id, note ? { note } : undefined).then((r) => r.data.data),
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await qc.cancelQueries({ queryKey: leaveKeys.requests() })

      // Snapshot previous value
      const prevAllRequests = qc.getQueryData(leaveKeys.allRequests())
      const prevMyRequests = qc.getQueryData(leaveKeys.myRequests())

      // Optimistically update to approved
      qc.setQueryData(leaveKeys.allRequests(), (old: any) => {
        if (!old) return old
        return old.map((req: any) =>
          req.id === id ? { ...req, status: 'approved' } : req
        )
      })

      qc.setQueryData(leaveKeys.myRequests(), (old: any) => {
        if (!old) return old
        return old.map((req: any) =>
          req.id === id ? { ...req, status: 'approved' } : req
        )
      })

      return { prevAllRequests, prevMyRequests }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.prevAllRequests) {
        qc.setQueryData(leaveKeys.allRequests(), context.prevAllRequests)
      }
      if (context?.prevMyRequests) {
        qc.setQueryData(leaveKeys.myRequests(), context.prevMyRequests)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      qc.invalidateQueries({ queryKey: leaveKeys.requests() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

export function useRejectRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      leaveApi.rejectRequest(id, { note }).then((r) => r.data.data),
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await qc.cancelQueries({ queryKey: leaveKeys.requests() })

      // Snapshot previous value
      const prevAllRequests = qc.getQueryData(leaveKeys.allRequests())
      const prevMyRequests = qc.getQueryData(leaveKeys.myRequests())

      // Optimistically update to rejected
      qc.setQueryData(leaveKeys.allRequests(), (old: any) => {
        if (!old) return old
        return old.map((req: any) =>
          req.id === id ? { ...req, status: 'rejected' } : req
        )
      })

      qc.setQueryData(leaveKeys.myRequests(), (old: any) => {
        if (!old) return old
        return old.map((req: any) =>
          req.id === id ? { ...req, status: 'rejected' } : req
        )
      })

      return { prevAllRequests, prevMyRequests }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.prevAllRequests) {
        qc.setQueryData(leaveKeys.allRequests(), context.prevAllRequests)
      }
      if (context?.prevMyRequests) {
        qc.setQueryData(leaveKeys.myRequests(), context.prevMyRequests)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      qc.invalidateQueries({ queryKey: leaveKeys.requests() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

export function useCancelRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leaveApi.cancelRequest(id).then((r) => r.data.data),
    onMutate: async (id) => {
      // Cancel outgoing queries
      await qc.cancelQueries({ queryKey: leaveKeys.requests() })

      // Snapshot previous value
      const prevMyRequests = qc.getQueryData(leaveKeys.myRequests())

      // Optimistically update to cancelled
      qc.setQueryData(leaveKeys.myRequests(), (old: any) => {
        if (!old) return old
        return old.map((req: any) =>
          req.id === id ? { ...req, status: 'cancelled' } : req
        )
      })

      return { prevMyRequests }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.prevMyRequests) {
        qc.setQueryData(leaveKeys.myRequests(), context.prevMyRequests)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      qc.invalidateQueries({ queryKey: leaveKeys.requests() })
      qc.invalidateQueries({ queryKey: leaveKeys.balances() })
    },
  })
}

// ── Calendar Hook ────────────────────────────────────────────
export function useCalendar(year: number, month: number) {
  return useQuery({
    queryKey: leaveKeys.calendar(year, month),
    queryFn: () => leaveApi.getCalendar(year, month).then((r) => r.data.data),
    staleTime: 10 * 60 * 1000, // 10 min — approved leave doesn't change often
    enabled: !!year && !!month,
  })
}

export function useHolidays(startDate: string, endDate: string) {
  return useQuery({
    queryKey: leaveKeys.holidays(startDate, endDate),
    queryFn: () => leaveApi.listHolidays(startDate, endDate).then((r) => r.data.data),
    staleTime: 30 * 60 * 1000, // 30 min — public holidays rarely change
    enabled: !!startDate && !!endDate,
  })
}
