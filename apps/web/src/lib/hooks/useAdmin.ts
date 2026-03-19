import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import admin, {
  type CreateProLicenseRequest,
  type UpdateFeatureFlagRequest,
  type UpdateProLicenseRequest,
  type UpdateAdminConfigRequest,
} from '../api/admin';

// ── System Stats ────────────────────────────────────────────────────────────

export function useSystemStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: admin.getSystemStats,
  });
}

// ── Feature Flags ───────────────────────────────────────────────────────────

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'feature-flags'],
    queryFn: admin.listFeatureFlags,
  });
}

export function useFeatureFlagByKey(key: string) {
  return useQuery({
    queryKey: ['admin', 'feature-flags', key],
    queryFn: () => admin.getFeatureFlag(key),
    enabled: !!key,
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: UpdateFeatureFlagRequest }) =>
      admin.updateFeatureFlag(key, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ── Pro Licenses ────────────────────────────────────────────────────────────

export function useProLicenses(status?: string) {
  return useQuery({
    queryKey: ['admin', 'pro-licenses', status],
    queryFn: () => admin.listProLicenses(status),
  });
}

export function useProLicenseByOrg(orgId: string) {
  return useQuery({
    queryKey: ['admin', 'pro-licenses', 'org', orgId],
    queryFn: () => admin.getProLicenseByOrg(orgId),
    enabled: !!orgId,
  });
}

export function useCreateProLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProLicenseRequest) => admin.createProLicense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pro-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useUpdateProLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProLicenseRequest }) =>
      admin.updateProLicense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pro-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ── Admin Configs ───────────────────────────────────────────────────────────

export function useAdminConfigs() {
  return useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: admin.listAdminConfigs,
  });
}

export function useUpdateAdminConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: UpdateAdminConfigRequest }) =>
      admin.updateAdminConfig(key, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
    },
  });
}
