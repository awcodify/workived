import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { claimsApi } from '@/lib/api/claims'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  SubmitClaimInput,
  ReviewClaimInput,
  ClaimFilters,
} from '@/types/api'

// ── Query Keys ───────────────────────────────────────────────
export const claimsKeys = {
  all: ['claims'] as const,

  categories: () => [...claimsKeys.all, 'categories'] as const,
  categoryTemplates: (countryCode?: string) => 
    [...claimsKeys.all, 'category-templates', countryCode] as const,

  claims: () => [...claimsKeys.all, 'claims'] as const,
  myClaims: (filters?: { cursor?: string; limit?: number }) =>
    [...claimsKeys.claims(), 'me', filters] as const,
  allClaims: (filters?: ClaimFilters) => [...claimsKeys.claims(), 'all', filters] as const,
  claim: (id: string) => [...claimsKeys.claims(), id] as const,

  summary: (year: number, month: number) =>
    [...claimsKeys.all, 'summary', year, month] as const,
}

// ── Category Hooks ───────────────────────────────────────────
export function useCategories() {
  return useQuery({
    queryKey: claimsKeys.categories(),
    queryFn: () => claimsApi.listCategories().then((r) => r.data.data),
    staleTime: 30 * 60 * 1000, // 30 min — categories rarely change
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      claimsApi.createCategory(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claimsKeys.categories() })
    },
  })
}

export function useUpdateCategory(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCategoryInput) =>
      claimsApi.updateCategory(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claimsKeys.categories() })
    },
  })
}

export function useDeactivateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => claimsApi.deactivateCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claimsKeys.categories() })
    },
  })
}

// ── Template Hooks ───────────────────────────────────────────
export function useCategoryTemplates(countryCode?: string) {
  return useQuery({
    queryKey: claimsKeys.categoryTemplates(countryCode),
    queryFn: () => claimsApi.listCategoryTemplates(countryCode).then((r) => r.data.data),
    staleTime: 30 * 60 * 1000, // 30 min — templates rarely change
    enabled: !!countryCode, // Only fetch if country code is provided
  })
}

export function useImportCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateIds: string[]) => claimsApi.importCategories(templateIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claimsKeys.categories() })
    },
  })
}

// ── Claim Hooks ──────────────────────────────────────────────
export function useMyClaims(filters?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: claimsKeys.myClaims(filters),
    queryFn: () => claimsApi.myClaims(filters).then((r) => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  })
}

export function useAllClaims(filters?: ClaimFilters) {
  return useQuery({
    queryKey: claimsKeys.allClaims(filters),
    queryFn: () => claimsApi.listClaims(filters).then((r) => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  })
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: claimsKeys.claim(id),
    queryFn: () => claimsApi.getClaim(id).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useSubmitClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ data, receipt }: { data: SubmitClaimInput; receipt?: File }) =>
      claimsApi.submitClaim(data, receipt).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claimsKeys.claims() })
      qc.invalidateQueries({ queryKey: claimsKeys.summary(new Date().getFullYear(), new Date().getMonth() + 1) })
    },
  })
}

export function useApproveClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ReviewClaimInput }) =>
      claimsApi.approveClaim(id, data).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: claimsKeys.claims() })
      qc.invalidateQueries({ queryKey: claimsKeys.claim(variables.id) })
      qc.invalidateQueries({ queryKey: claimsKeys.summary(new Date().getFullYear(), new Date().getMonth() + 1) })
    },
  })
}

export function useRejectClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Required<ReviewClaimInput> }) =>
      claimsApi.rejectClaim(id, data).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: claimsKeys.claims() })
      qc.invalidateQueries({ queryKey: claimsKeys.claim(variables.id) })
    },
  })
}

export function useCancelClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => claimsApi.cancelClaim(id).then((r) => r.data.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: claimsKeys.claims() })
      qc.invalidateQueries({ queryKey: claimsKeys.claim(id) })
    },
  })
}

// ── Summary Hooks ────────────────────────────────────────────
export function useMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: claimsKeys.summary(year, month),
    queryFn: () => claimsApi.getMonthlySummary(year, month).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}
