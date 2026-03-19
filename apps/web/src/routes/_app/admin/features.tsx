import { createFileRoute } from '@tanstack/react-router';
import { useFeatureFlags, useUpdateFeatureFlag } from '../../../lib/hooks/useAdmin';
import { useState } from 'react';
import { Zap, Globe, Building2, User, ChevronLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { FeatureFlag } from '../../../lib/api/admin';

export const Route = createFileRoute('/_app/admin/features')({
  component: FeaturesPage,
});

function FeaturesPage() {
  const { data: flags, isLoading } = useFeatureFlags();
  const updateFlag = useUpdateFeatureFlag();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdating(flag.feature_key);
    try {
      await updateFlag.mutateAsync({
        key: flag.feature_key,
        payload: {
          is_enabled: !flag.is_enabled,
          scope: flag.scope,
          target_ids: flag.target_ids,
        },
      });
    } finally {
      setUpdating(null);
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global':
        return <Globe className="h-4 w-4" />;
      case 'org':
        return <Building2 className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getScopeBadgeClass = (scope: string) => {
    switch (scope) {
      case 'global':
        return 'bg-blue-100 text-blue-700';
      case 'org':
        return 'bg-purple-100 text-purple-700';
      case 'user':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-400">Loading feature flags...</div>
      </div>
    );
  }

  return (
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
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Feature Flags</h1>
            <p className="mt-1 text-sm text-gray-500">
              Control feature availability across the Workived platform
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm text-blue-800">
          <strong>Scope Types:</strong>
          <ul className="mt-2 ml-4 space-y-1">
            <li>• <strong>Global</strong> — Available to all users and organisations when enabled</li>
            <li>• <strong>Org</strong> — Enabled only for specific organisations (requires target_ids)</li>
            <li>• <strong>User</strong> — Enabled only for specific users (requires target_ids)</li>
          </ul>
        </div>
      </div>

      {/* Feature Flags List */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="divide-y divide-gray-200">
          {flags && flags.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No feature flags configured
            </div>
          ) : (
            flags?.map((flag) => (
              <div key={flag.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">{flag.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${getScopeBadgeClass(flag.scope)}`}
                      >
                        {getScopeIcon(flag.scope)}
                        {flag.scope}
                      </span>
                      {flag.is_enabled ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Enabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800">
                        {flag.feature_key}
                      </code>
                    </div>
                    {flag.description && (
                      <p className="mt-2 text-sm text-gray-500">{flag.description}</p>
                    )}
                    {flag.target_ids && Object.keys(flag.target_ids).length > 0 && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3">
                        <div className="text-xs font-medium text-gray-700">Target IDs:</div>
                        <pre className="mt-1 text-xs text-gray-600">
                          {JSON.stringify(flag.target_ids, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-gray-400">
                      Last updated: {new Date(flag.updated_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(flag)}
                    disabled={updating === flag.feature_key}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      flag.is_enabled ? 'bg-blue-600': 'bg-gray-200'
                    } ${updating === flag.feature_key ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        flag.is_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
