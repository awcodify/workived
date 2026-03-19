import { apiClient } from './client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  feature_key: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  scope: 'global' | 'org' | 'user';
  target_ids?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProLicense {
  id: string;
  organisation_id: string;
  license_type: 'trial' | 'monthly' | 'annual';
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  max_employees?: number;
  starts_at: string;
  expires_at: string;
  cancelled_at?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminConfig {
  key: string;
  value: any; // Can be boolean, number, string, or object (JSONB)
  description?: string;
  updated_by?: string;
  updated_at: string;
}

export interface SystemStats {
  total_organisations: number;
  free_organisations: number;
  pro_organisations: number;
  total_users: number;
  total_employees: number;
  active_features: FeatureFlag[];
  active_licenses: number;
  expiring_licenses: ProLicense[];
}

export interface UpdateFeatureFlagRequest {
  is_enabled: boolean;
  scope?: 'global' | 'org' | 'user';
  target_ids?: Record<string, any>;
}

export interface CreateProLicenseRequest {
  organisation_id: string;
  license_type: 'trial' | 'monthly' | 'annual';
  max_employees?: number;
  duration_days: number;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
}

export interface UpdateProLicenseRequest {
  status?: 'active' | 'expired' | 'cancelled' | 'suspended';
  max_employees?: number;
  expires_at?: string;
}

export interface UpdateAdminConfigRequest {
  value: any; // Can be boolean, number, string, or object (JSONB)
}

// ── API Client ──────────────────────────────────────────────────────────────

const admin = {
  // System Stats
  getSystemStats: async () => {
    const { data } = await apiClient.get<{ data: SystemStats }>('/api/v1/admin/stats');
    return data.data;
  },

  // Feature Flags
  listFeatureFlags: async () => {
    const { data } = await apiClient.get<{ data: FeatureFlag[] }>('/api/v1/admin/feature-flags');
    return data.data;
  },

  getFeatureFlag: async (key: string) => {
    const { data } = await apiClient.get<{ data: FeatureFlag }>(`/api/v1/admin/feature-flags/${key}`);
    return data.data;
  },

  updateFeatureFlag: async (key: string, payload: UpdateFeatureFlagRequest) => {
    const { data } = await apiClient.patch<{ data: FeatureFlag }>(
      `/api/v1/admin/feature-flags/${key}`,
      payload
    );
    return data.data;
  },

  // Pro Licenses
  listProLicenses: async (status?: string) => {
    const { data } = await apiClient.get<{ data: ProLicense[] }>('/api/v1/admin/pro-licenses', {
      params: { status },
    });
    return data.data;
  },

  getProLicenseByOrg: async (orgId: string) => {
    const { data } = await apiClient.get<{ data: ProLicense }>(`/api/v1/admin/pro-licenses/org/${orgId}`);
    return data.data;
  },

  createProLicense: async (payload: CreateProLicenseRequest) => {
    const { data } = await apiClient.post<{ data: ProLicense }>('/api/v1/admin/pro-licenses', payload);
    return data.data;
  },

  updateProLicense: async (id: string, payload: UpdateProLicenseRequest) => {
    const { data } = await apiClient.patch<{ data: ProLicense }>(
      `/api/v1/admin/pro-licenses/${id}`,
      payload
    );
    return data.data;
  },

  // Admin Configs
  listAdminConfigs: async () => {
    const { data } = await apiClient.get<{ data: AdminConfig[] }>('/api/v1/admin/configs');
    return data.data;
  },

  updateAdminConfig: async (key: string, payload: UpdateAdminConfigRequest) => {
    const { data } = await apiClient.patch<{ data: AdminConfig }>(
      `/api/v1/admin/configs/${key}`,
      payload
    );
    return data.data;
  },

  // Enabled features for current user's org (public — no super_admin required)
  getEnabledFeatures: async () => {
    const { data } = await apiClient.get<{ data: Record<string, boolean> }>('/api/v1/features');
    return data.data;
  },
};

export default admin;
