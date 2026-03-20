import { useState, useEffect, useMemo } from 'react'
import { X, Download, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { useCategoryTemplates, useImportCategories, useCategories } from '@/lib/hooks/useClaims'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.claims

interface ImportCategoryTemplatesModalProps {
  onClose: () => void
}

export function ImportCategoryTemplatesModal({ onClose }: ImportCategoryTemplatesModalProps) {
  const { data: organisation } = useOrganisation()
  const { data: templates, isLoading } = useCategoryTemplates(organisation?.country_code)
  const { data: existingCategories } = useCategories()
  const importMutation = useImportCategories()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showConflictWarning, setShowConflictWarning] = useState(false)

  // Check for conflicts between selected templates and existing categories
  const conflicts = useMemo(() => {
    if (!templates || !existingCategories || selectedIds.size === 0) return []
    
    const selectedTemplates = templates.filter(t => selectedIds.has(t.id))
    const existingNames = new Set(existingCategories.map(c => c.name))
    
    return selectedTemplates.filter(tmpl => existingNames.has(tmpl.name))
  }, [templates, existingCategories, selectedIds])

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
    
    // Check for conflicts - if any exist, show warning first
    if (conflicts.length > 0 && !showConflictWarning) {
      setShowConflictWarning(true)
      return
    }
    
    // Proceed with import
    try {
      await importMutation.mutateAsync(Array.from(selectedIds))
      setShowConflictWarning(false)
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleCancelConflict = () => {
    setShowConflictWarning(false)
  }

  const allSelected = templates && templates.length > 0 && selectedIds.size === templates.length

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

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
              Import Claim Categories
            </h2>
            <p className="text-sm mt-1" style={{ color: t.textMuted }}>
              Select templates to import as claim categories for your organisation
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
                  Successfully imported {importMutation.data.data.data.created_count} categor
                  {importMutation.data.data.data.created_count === 1 ? 'y' : 'ies'}
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

          {/* Conflict Warning */}
          {showConflictWarning && conflicts.length > 0 && (
            <div
              className="p-4 mb-4"
              style={{
                background: '#FFFBEB',
                borderRadius: 12,
                border: '1px solid #FCD34D',
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle size={20} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-semibold mb-1" style={{ color: '#92400E' }}>
                    Duplicate categories detected
                  </p>
                  <p className="text-sm mb-2" style={{ color: '#92400E', opacity: 0.9 }}>
                    The following templates have the same name as your existing categories:
                  </p>
                  <ul className="text-sm space-y-1 mb-3" style={{ color: '#92400E', opacity: 0.8 }}>
                    {conflicts.map((conflict) => (
                      <li key={conflict.id} className="ml-4">
                        • {conflict.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm" style={{ color: '#92400E', opacity: 0.9 }}>
                    Importing will skip these templates. Do you want to continue?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelConflict}
                  className="px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
                  style={{
                    color: '#92400E',
                    borderRadius: 8,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: '#F59E0B',
                    color: '#FFFFFF',
                    borderRadius: 8,
                  }}
                >
                  {importMutation.isPending ? 'Importing...' : 'Import Anyway'}
                </button>
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
                  <div
                    key={template.id}
                    onClick={() => handleToggle(template.id)}
                    className="cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      background: selectedIds.has(template.id) ? t.surfaceHover : t.surface,
                      borderRadius: 12,
                      border: `2px solid ${
                        selectedIds.has(template. id) ? t.accent : t.border
                      }`,
                      padding: 16,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(template.id)}
                        onChange={() => handleToggle(template.id)}
                        className="mt-0.5 w-5 h-5 rounded transition-colors cursor-pointer"
                        style={{ accentColor: t.accent }}
                      />
                      <div className="flex-1">
                        <p className="font-semibold mb-1" style={{ color: t.text }}>
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-sm mb-2" style={{ color: t.textMuted }}>
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs" style={{ color: t.textMuted }}>
                          {template.monthly_limit && template.currency_code && (
                            <span className="font-semibold">
                              Limit: {formatCurrency(template.monthly_limit, template.currency_code)}/mo
                            </span>
                          )}
                          {!template.monthly_limit && (
                            <span className="font-semibold">No limit</span>
                          )}
                          <span>
                            {template.requires_receipt ? 'Receipt required' : 'Receipt optional'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
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
                color: t.textMuted,
                borderRadius: 12,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className="px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 12,
              }}
            >
              {importMutation.isPending
                ? 'Importing...'
                : `Import ${selectedIds.size} categor${selectedIds.size === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
