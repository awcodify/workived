import { apiClient } from './client'
import type {
  ApiResponse,
  Organisation,
  CreateOrgRequest,
  CreateOrgResponse,
  UpdateOrgRequest,
  TransferOwnershipRequest,
  OrgDetail,
  InviteMemberRequest,
  InviteResponse,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  PendingInvitation,
  UnlinkedMember,
  MemberWithProfile,
} from '@/types/api'

export const organisationsApi = {
  getMine: () =>
    apiClient.get<ApiResponse<OrgDetail>>('/api/v1/organisations/me'),

  getDetail: () =>
    apiClient.get<ApiResponse<OrgDetail>>('/api/v1/organisations/me'),

  update: (data: UpdateOrgRequest) =>
    apiClient.put<ApiResponse<Organisation>>('/api/v1/organisations/me', data),

  transferOwnership: (data: TransferOwnershipRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/api/v1/organisations/me/transfer-ownership', data),

  create: (data: CreateOrgRequest) =>
    apiClient.post<ApiResponse<CreateOrgResponse>>('/api/v1/organisations', data),

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

  // Members without an HR employee record — used by the Add Employee form
  listUnlinkedMembers: () =>
    apiClient.get<ApiResponse<UnlinkedMember[]>>('/api/v1/organisations/members/unlinked'),

  // All active members with HR profile link status — used by Settings → Members page
  listMembers: () =>
    apiClient.get<ApiResponse<MemberWithProfile[]>>('/api/v1/organisations/members'),
}
