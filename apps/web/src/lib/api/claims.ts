import { apiClient } from './client'
import type {
  ClaimCategory,
  CategoryTemplate,
  Claim,
  ClaimWithDetails,
  ClaimBalanceWithCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  SubmitClaimInput,
  ReviewClaimInput,
  ClaimFilters,
  ClaimMonthlySummary,
  ApiResponse,
  CursorMeta,
} from '@/types/api'

// ── Response Types ───────────────────────────────────────────
interface CategoryListResponse {
  data: ClaimCategory[]
  meta?: CursorMeta
}

interface ClaimListResponse {
  data: ClaimWithDetails[]
  meta?: CursorMeta
}

interface SummaryResponse {
  data: ClaimMonthlySummary[]
}

// ── API Client ───────────────────────────────────────────────
export const claimsApi = {
  // ── Categories ─────────────────────────────────────────────
  listCategories: () =>
    apiClient.get<CategoryListResponse>('/api/v1/claims/categories'),

  createCategory: (data: CreateCategoryInput) =>
    apiClient.post<ApiResponse<ClaimCategory>>('/api/v1/claims/categories', data),

  updateCategory: (id: string, data: UpdateCategoryInput) =>
    apiClient.put<ApiResponse<ClaimCategory>>(`/api/v1/claims/categories/${id}`, data),

  deactivateCategory: (id: string) =>
    apiClient.delete(`/api/v1/claims/categories/${id}`),

  // ── Templates ──────────────────────────────────────────────
  listCategoryTemplates: (countryCode?: string) =>
    apiClient.get<ApiResponse<CategoryTemplate[]>>('/api/v1/claims/categories/templates', {
      params: countryCode ? { country_code: countryCode } : undefined,
    }),

  importCategories: (templateIds: string[]) =>
    apiClient.post<ApiResponse<{ categories: ClaimCategory[]; created_count: number }>>(
      '/api/v1/claims/categories/import',
      { template_ids: templateIds }
    ),

  // ── Balances ───────────────────────────────────────────────
  myBalances: (year: number, month: number) =>
    apiClient.get<ApiResponse<ClaimBalanceWithCategory[]>>('/api/v1/claims/balances/me', {
      params: { year, month },
    }),

  // ── Claims ─────────────────────────────────────────────────
  submitClaim: (data: SubmitClaimInput, receipt?: File) => {
    const formData = new FormData()
    formData.append('category_id', data.category_id)
    formData.append('amount', data.amount.toString())
    formData.append('currency_code', data.currency_code)
    formData.append('description', data.description)
    formData.append('claim_date', data.claim_date) // YYYY-MM-DD format
    
    if (receipt) {
      formData.append('receipt', receipt)
    }

    return apiClient.post<ApiResponse<Claim>>('/api/v1/claims', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  listClaims: (filters?: ClaimFilters) =>
    apiClient.get<ClaimListResponse>('/api/v1/claims', {
      params: filters,
    }),

  myClaims: (filters?: Pick<ClaimFilters, 'cursor' | 'limit'>) =>
    apiClient.get<ClaimListResponse>('/api/v1/claims/me', {
      params: filters,
    }),

  getClaim: (id: string) =>
    apiClient.get<ApiResponse<ClaimWithDetails>>(`/api/v1/claims/${id}`),

  approveClaim: (id: string, data?: ReviewClaimInput) =>
    apiClient.post<ApiResponse<Claim>>(
      `/api/v1/claims/${id}/approve`,
      data || {},
    ),

  rejectClaim: (id: string, data: Required<ReviewClaimInput>) =>
    apiClient.post<ApiResponse<Claim>>(
      `/api/v1/claims/${id}/reject`,
      data,
    ),

  cancelClaim: (id: string) =>
    apiClient.post<ApiResponse<Claim>>(`/api/v1/claims/${id}/cancel`),

  // ── Summaries ──────────────────────────────────────────────
  getMonthlySummary: (year: number, month: number) =>
    apiClient.get<SummaryResponse>('/api/v1/claims/summary', {
      params: { year, month },
    }),
}
