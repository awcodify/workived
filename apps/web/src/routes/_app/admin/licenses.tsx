import { createFileRoute } from '@tanstack/react-router';
import { useProLicenses, useCreateProLicense, useUpdateProLicense } from '../../../lib/hooks/useAdmin';
import { useState } from 'react';
import { Award, Plus, ChevronLeft, Calendar, Building2, CreditCard } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { ProLicense, CreateProLicenseRequest, UpdateProLicenseRequest } from '../../../lib/api/admin';

export const Route = createFileRoute('/_app/admin/licenses')({
  component: LicensesPage,
});

type LicenseFormData = {
  organisation_id: string;
  license_type: 'trial' | 'monthly' | 'annual';
  duration_days: number;
  max_employees: number;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
};

function LicensesPage() {
  const { data: licenses, isLoading } = useProLicenses();
  const createLicense = useCreateProLicense();
  const updateLicense = useUpdateProLicense();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLicense, setEditingLicense] = useState<ProLicense | null>(null);
  const [formData, setFormData] = useState<LicenseFormData>({
    organisation_id: '',
    license_type: 'annual',
    duration_days: 365,
    max_employees: 100,
    stripe_subscription_id: '',
    stripe_customer_id: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateProLicenseRequest = {
      organisation_id: formData.organisation_id,
      license_type: formData.license_type,
      duration_days: formData.duration_days,
      max_employees: formData.max_employees,
      ...(formData.stripe_subscription_id && { stripe_subscription_id: formData.stripe_subscription_id }),
      ...(formData.stripe_customer_id && { stripe_customer_id: formData.stripe_customer_id }),
    };
    
    await createLicense.mutateAsync(payload);
    setShowCreateForm(false);
    resetForm();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;
    
    const payload: UpdateProLicenseRequest = {
      max_employees: formData.max_employees,
      status: editingLicense.status,
    };
    
    await updateLicense.mutateAsync({ id: editingLicense.id, payload });
    setEditingLicense(null);
    resetForm();
  };

  const handleToggleStatus = async (license: ProLicense) => {
    const newStatus = license.status === 'active' ? 'suspended' : 'active';
    await updateLicense.mutateAsync({
      id: license.id,
      payload: {
        status: newStatus,
      },
    });
  };

  const resetForm = () => {
    setFormData({
      organisation_id: '',
      license_type: 'annual',
      duration_days: 365,
      max_employees: 100,
      stripe_subscription_id: '',
      stripe_customer_id: '',
    });
  };

  const getStatusBadge = (license: ProLicense) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-600',
      suspended: 'bg-amber-100 text-amber-800',
    };

    const color = statusColors[license.status] || 'bg-gray-100 text-gray-600';
    const label = license.status.charAt(0).toUpperCase() + license.status.slice(1);

    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-400">Loading Pro licenses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-11 md:py-10">
      <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Pro Licenses</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage Pro plan licenses and billing
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create License
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingLicense) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingLicense ? 'Edit License' : 'Create New License'}
          </h2>
          <form onSubmit={editingLicense ? handleUpdate : handleCreate} className="space-y-4">
            {!editingLicense && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Organisation ID</label>
                <input
                  type="text"
                  required
                  value={formData.organisation_id}
                  onChange={(e) => setFormData({ ...formData, organisation_id: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="org_123456789"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {!editingLicense && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">License Type</label>
                  <select
                    required
                    value={formData.license_type}
                    onChange={(e) => setFormData({ ...formData, license_type: e.target.value as 'trial' | 'monthly' | 'annual' })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="trial">Trial</option>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (days)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Max Employees</label>
              <input
                type="number"
                required
                min="1"
                value={formData.max_employees}
                onChange={(e) => setFormData({ ...formData, max_employees: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {!editingLicense && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stripe Subscription ID (optional)</label>
                  <input
                    type="text"
                    value={formData.stripe_subscription_id}
                    onChange={(e) => setFormData({ ...formData, stripe_subscription_id: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="sub_xxxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stripe Customer ID (optional)</label>
                  <input
                    type="text"
                    value={formData.stripe_customer_id}
                    onChange={(e) => setFormData({ ...formData, stripe_customer_id: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="cus_xxxxxxxxxxxxx"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createLicense.isPending || updateLicense.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editingLicense ? 'Update' : 'Create'} License
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingLicense(null);
                  resetForm();
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Licenses Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Organisation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Max Employees
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Billing
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {licenses && licenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No Pro licenses found
                </td>
              </tr>
            ) : (
              licenses?.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <code className="text-xs font-mono text-gray-900">{license.organisation_id}</code>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(license.starts_at).toLocaleDateString()} — {new Date(license.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.max_employees ?? 'Unlimited'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(license)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {license.stripe_subscription_id ? (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <CreditCard className="h-4 w-4" />
                        <code>{license.stripe_subscription_id}</code>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No billing</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => {
                        setEditingLicense(license);
                        setFormData({
                          organisation_id: license.organisation_id,
                          license_type: license.license_type,
                          duration_days: 365, // Default value for edit
                          max_employees: license.max_employees ?? 100,
                          stripe_subscription_id: license.stripe_subscription_id || '',
                          stripe_customer_id: license.stripe_customer_id || '',
                        });
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(license)}
                      className={license.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                    >
                      {license.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
