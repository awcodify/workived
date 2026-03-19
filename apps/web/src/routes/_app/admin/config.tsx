import { createFileRoute } from '@tanstack/react-router';
import { useAdminConfigs, useUpdateAdminConfig } from '../../../lib/hooks/useAdmin';
import { useState } from 'react';
import { Settings, ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { AdminConfig } from '../../../lib/api/admin';

export const Route = createFileRoute('/_app/admin/config')({
  component: ConfigPage,
});

function ConfigPage() {
  const { data: configs, isLoading } = useAdminConfigs();
  const updateConfig = useUpdateAdminConfig();
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  const handleStartEdit = (config: AdminConfig) => {
    setEditingConfig(config.key);
    setEditValue(config.value);
  };

  const handleSave = async (key: string) => {
    await updateConfig.mutateAsync({
      key,
      payload: { value: editValue },
    });
    setEditingConfig(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingConfig(null);
    setEditValue('');
  };

  const renderConfigInput = (config: AdminConfig) => {
    if (editingConfig !== config.key) {
      return null;
    }

    // Handle different value types
    if (typeof config.value === 'boolean') {
      return (
        <select
          value={editValue.toString()}
          onChange={(e) => setEditValue(e.target.value === 'true')}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="true">Enabled (true)</option>
          <option value="false">Disabled (false)</option>
        </select>
      );
    }

    if (typeof config.value === 'number') {
      return (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(parseInt(e.target.value))}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      );
    }

    // String or JSON object
    if (typeof config.value === 'object') {
      return (
        <textarea
          value={typeof editValue === 'string' ? editValue : JSON.stringify(editValue, null, 2)}
          onChange={(e) => {
            try {
              setEditValue(JSON.parse(e.target.value));
            } catch {
              setEditValue(e.target.value);
            }
          }}
          rows={6}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
      />
    );
  };

  const renderValue = (value: any) => {
    if (typeof value === 'boolean') {
      return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {value ? 'Enabled' : 'Disabled'}
        </span>
      );
    }

    if (typeof value === 'object') {
      return (
        <pre className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return <span className="text-sm text-gray-900">{String(value)}</span>;
  };

  const getConfigIcon = (key: string) => {
    if (key.includes('maintenance')) return '🔧';
    if (key.includes('signup') || key.includes('registration')) return '📝';
    if (key.includes('free') || key.includes('tier')) return '🎁';
    if (key.includes('email')) return '📧';
    if (key.includes('notification')) return '🔔';
    return '⚙️';
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-400">Loading system configuration...</div>
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
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2">
            <Settings className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">System Configuration</h1>
            <p className="mt-1 text-sm text-gray-500">
              Global settings affecting all users and organisations
            </p>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Warning:</strong> Changes to these settings affect the entire Workived platform.
            Exercise caution when modifying critical configurations like maintenance mode or signup restrictions.
          </div>
        </div>
      </div>

      {/* Configuration List */}
      <div className="space-y-4">
        {configs && configs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm">
            No system configurations found
          </div>
        ) : (
          configs?.map((config) => (
            <div key={config.key} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getConfigIcon(config.key)}</span>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 capitalize">
                        {config.key.replace(/_/g, ' ')}
                      </h3>
                      <code className="mt-1 inline-block rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700">
                        {config.key}
                      </code>
                    </div>
                  </div>

                  {config.description && (
                    <p className="mt-3 text-sm text-gray-600">{config.description}</p>
                  )}

                  <div className="mt-4">
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                      Current Value
                    </div>
                    {editingConfig === config.key ? (
                      <div>
                        {renderConfigInput(config)}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleSave(config.key)}
                            disabled={updateConfig.isPending}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            Save Changes
                          </button>
                          <button
                            onClick={handleCancel}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">{renderValue(config.value)}</div>
                        <button
                          onClick={() => handleStartEdit(config)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 text-xs text-gray-400">
                    Last updated: {new Date(config.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
