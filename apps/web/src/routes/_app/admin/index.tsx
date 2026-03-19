import { createFileRoute, Link } from '@tanstack/react-router';
import { useSystemStats } from '../../../lib/hooks/useAdmin';
import {
  Building2,
  Users,
  UserCheck,
  Zap,
  Shield,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const Route = createFileRoute('/_app/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useSystemStats();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-400">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-11 md:py-10">
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Workived Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Internal tools for managing Workived system configuration
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Organisations"
          value={stats?.total_organisations || 0}
          icon={<Building2 className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Free Tier"
          value={stats?.free_organisations || 0}
          icon={<Users className="h-6 w-6" />}
          color="gray"
        />
        <StatCard
          title="Pro Tier"
          value={stats?.pro_organisations || 0}
          icon={<Shield className="h-6 w-6" />}
          color="purple"
        />
        <StatCard
          title="Active Licenses"
          value={stats?.active_licenses || 0}
          icon={<UserCheck className="h-6 w-6" />}
          color="green"
        />
      </div>

      {/* User & Employee Stats */}
      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard
          title="Total Users"
          value={stats?.total_users || 0}
          icon={<Users className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Total Employees"
          value={stats?.total_employees || 0}
          icon={<UserCheck className="h-6 w-6" />}
          color="indigo"
        />
      </div>

      {/* Active Features */}
      {stats && stats.active_features && stats.active_features.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Active Features</h2>
                <p className="text-sm text-gray-500">
                  {stats.active_features.length} feature{stats.active_features.length !== 1 ? 's' : ''} enabled globally
                </p>
              </div>
            </div>
            <Link
              to="/admin/features"
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Manage
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.active_features.map((feature) => (
                <div
                  key={feature.feature_key}
                  className="rounded-lg border border-green-200 bg-green-50 px-4 py-3"
                >
                  <div className="font-medium text-green-900">{feature.name}</div>
                  {feature.description && (
                    <div className="mt-1 text-sm text-green-700">{feature.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expiring Licenses Warning */}
      {stats && stats.expiring_licenses && stats.expiring_licenses.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-amber-900">Expiring Licenses</h2>
                <p className="text-sm text-amber-700">
                  {stats.expiring_licenses.length} license{stats.expiring_licenses.length !== 1 ? 's' : ''} expiring within 7 days
                </p>
              </div>
            </div>
            <Link
              to="/admin/licenses"
              className="flex items-center gap-2 text-sm font-medium text-amber-900 hover:text-amber-800"
            >
              Review
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {stats.expiring_licenses.map((license) => (
                <div
                  key={license.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      Organisation ID: {license.organisation_id.slice(0, 8)}...
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {license.license_type.charAt(0).toUpperCase() + license.license_type.slice(1)} •
                      Expires {new Date(license.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    {license.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Link
            to="/admin/features"
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="rounded-lg bg-blue-100 p-2 w-fit">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Manage Features</div>
              <div className="mt-1 text-sm text-gray-500">
                Toggle feature flags and control rollouts
              </div>
            </div>
          </Link>

          <Link
            to="/admin/licenses"
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:border-purple-300 hover:bg-purple-50"
          >
            <div className="rounded-lg bg-purple-100 p-2 w-fit">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Pro Licenses</div>
              <div className="mt-1 text-sm text-gray-500">
                Create and manage Pro subscriptions
              </div>
            </div>
          </Link>

          <Link
            to="/admin/config"
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:border-green-300 hover:bg-green-50"
          >
            <div className="rounded-lg bg-green-100 p-2 w-fit">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">System Config</div>
              <div className="mt-1 text-sm text-gray-500">
                Manage system-wide configuration
              </div>
            </div>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'gray' | 'purple' | 'green' | 'indigo';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
