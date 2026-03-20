import { useState, useEffect } from 'react'
import { X, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTemplates, useImportPolicies } from '@/lib/hooks/useLeave'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import type { PolicyTemplate } from '@/types/api'
import { moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

interface ImportTemplatesModalProps {
  onClose: () => void
}

export function ImportTemplatesModal({ onClose }: ImportTemplatesModalProps) {
  const { data: organisation } = useOrganisation()
  const { data: templates, isLoading } = useTemplates(organisation?.country_code)
  const importMutation = useImportPolicies()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Close dialog on successful import
  useEffect(() => {
    if (importMutation.isSuccess) {
      const timer = setTimeout(onClose, 1500)
      return () => clearTimeout(timer)
    }
  }, [importMutation.isSuccess, onClose])

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!templates) return
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(templates.map((t) => t.id)))
    }
  }

  const handleImport = async () => {
    if (selectedIds.size === 0) return
    try {
      await importMutation.mutateAsync(Array.from(selectedIds))
    } catch (error) {
      // Error handled by mutation
    }
  }

  const allSelected = templates && templates.length > 0 && selectedIds.size === templates.length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 top-1/2 -translate-y-1/2 z-50 max-w-2xl w-full"
        style={{
          background: t.surface,
          borderRadius: 18,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 pb-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <div>
            <h2
              className="font-bold"
              style={{
                fontSize: typography.h2.size,
                letterSpacing: typography.h2.tracking,
                color: t.text,
              }}
            >
              Import Leave Policies
            </h2>
            <p className="text-sm mt-1" style={{ color: t.textMuted }}>
              Select templates to import as leave policies for your organisation
            </p>
          </div>
          <button
            onClick={onClose}
            className="transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Success State */}
          {importMutation.isSuccess && importMutation.data?.data?.data && (
            <div
              className="flex items-center gap-3 p-4 mb-4"
              style={{
                background: '#F0FDF4',
                borderRadius: 12,
                border: '1px solid #86EFAC',
              }}
            >
              <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
              <div>
                <p className="font-semibold" style={{ color: '#16A34A' }}>
                  Successfully imported {importMutation.data.data.data.created_count} polic
                  {importMutation.data.data.data.created_count === 1 ? 'y' : 'ies'}
                </p>
                <p className="text-sm" style={{ color: '#16A34A', opacity: 0.8 }}>
                  Balances have been created for all employees
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {importMutation.isError && (
            <div
              className="flex items-center gap-3 p-4 mb-4"
              style={{
                background: '#FEF2F2',
                borderRadius: 12,
                border: '1px solid #FCA5A5',
              }}
            >
              <AlertCircle size={20} style={{ color: '#DC2626' }} />
              <div>
                <p className="font-semibold" style={{ color: '#DC2626' }}>
                  Import failed
                </p>
                <p className="text-sm" style={{ color: '#DC2626', opacity: 0.8 }}>
                  {importMutation.error instanceof Error
                    ? importMutation.error.message
                    : 'An error occurred while importing templates'}
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse p-4"
                  style={{
                    background: t.surfaceHover,
                    borderRadius: 12,
                    height: 80,
                  }}
                />
              ))}
            </div>
          )}

          {/* Templates List */}
          {!isLoading && templates && templates.length > 0 && (
            <>
              {/* Select All */}
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 mb-3 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: t.accent }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>

              <div className="space-y-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedIds.has(template.id)}
                    onToggle={() => handleToggle(template.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {!isLoading && (!templates || templates.length === 0) && (
            <div
              className="flex flex-col items-center justify-center text-center py-8"
              style={{ color: t.textMuted }}
            >
              <Download size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p className="font-semibold">No templates available</p>
              <p className="text-sm mt-1">
                No templates found for {organisation?.country_code || 'your country'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {templates && templates.length > 0 && (
          <div
            className="flex items-center justify-end gap-3 p-6 pt-4"
            style={{ borderTop: `1px solid ${t.border}` }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{
                color: t.text,
                borderRadius: 12,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 12,
              }}
            >
              <Download size={16} />
              {importMutation.isPending
                ? 'Importing...'
                : `Import ${selectedIds.size} ${selectedIds.size === 1 ? 'Policy' : 'Policies'}`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

interface TemplateCardProps {
  template: PolicyTemplate
  isSelected: boolean
  onToggle: () => void
}

function TemplateCard({ template, isSelected, onToggle }: TemplateCardProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left p-4 transition-all duration-150"
      style={{
        background: isSelected ? t.surfaceHover : '#FFFFFF',
        borderRadius: 12,
        border: `2px solid ${isSelected ? t.accent : t.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          className="flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors"
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `2px solid ${isSelected ? t.accent : t.border}`,
            background: isSelected ? t.accent : 'transparent',
          }}
        >
          {isSelected && <CheckCircle2 size={14} style={{ color: t.accentText }} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold mb-1"
            style={{
              fontSize: typography.body.size,
              color: t.text,
            }}
          >
            {template.name}
          </h3>

          {template.description && (
            <p
              className="text-sm mb-2"
              style={{ color: t.textMuted, lineHeight: 1.4 }}
            >
              {template.description}
            </p>
          )}

          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
            style={{ color: t.textMuted }}
          >
            <span>{template.entitled_days_per_year} days per year</span>
            {template.is_carry_over_allowed && template.max_carry_over_days && (
              <span>• Carry over: {template.max_carry_over_days} days</span>
            )}
            {template.requires_approval && <span>• Requires approval</span>}
            {template.is_accrued && <span>• Accrued</span>}
          </div>
        </div>
      </div>
    </button>
  )
}
