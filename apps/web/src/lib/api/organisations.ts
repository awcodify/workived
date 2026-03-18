import { apiClient } from './client'
import type {
  ApiResponse,
  Organisation,
  CreateOrgRequest,
  InviteMemberRequest,
  InviteResponse,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  PendingInvitation,
} from '@/types/api'

export const organisationsApi = {
  getMine: () =>
    apiClient.get<ApiResponse<Organisation>>('/api/v1/organisations/me'),

  create: (data: CreateOrgRequest) =>
    apiClient.post<ApiResponse<Organisation>>('/api/v1/organisations', data),

  // Invitation management
  invite: (data: InviteMemberRequest) =>
    apiClient.post<ApiResponse<InviteResponse>>('/api/v1/organisations/invitations', data),

  listInvitations: () =>
    apiClient.get<ApiResponse<PendingInvitation[]>>('/api/v1/organisations/invitations'),

  revokeInvitation: (id: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/api/v1/organisations/invitations/${id}`),

  // Accept invitation — called by invitee (auth-only, no tenant context needed)
  acceptInvitation: (data: AcceptInvitationRequest) =>
    apiClient.post<ApiResponse<AcceptInvitationResponse>>('/api/v1/invitations/accept', data),
}
