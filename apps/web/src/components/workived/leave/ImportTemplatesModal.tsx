import { useState } from 'react'
import { X, Download, CheckCircle2 } from 'lucide-react'
import { useTemplates } from '@/lib/hooks/useLeave'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import type { PolicyTemplate } from '@/types/api'
import { moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

interface ImportTemplatesModalProps {
  onClose: () => void
  onImportToForm?: (template: PolicyTemplate) => void
}

export function ImportTemplatesModal({ onClose, onImportToForm }: ImportTemplatesModalProps) {
  const { data: organisation } = useOrganisation()
  const { data: templates, isLoading } = useTemplates(organisation?.country_code)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    // Radio-style selection: toggle if clicking the same, otherwise select new one
    setSelectedId(selectedId === id ? null : id)
  }

  const handleImport = () => {
    if (!selectedId || !templates || !onImportToForm) return
    
    const selectedTemplate = templates.find(t => t.id === selectedId)
    if (selectedTemplate) {
      onImportToForm(selectedTemplate)
    }
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
        data-testid="import-templates-modal"
        className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 top-1/2 -translate-y-1/2 z-[100] max-w-2xl w-full"
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
              Select a template to review and import as a leave policy
            </p>
          </div>
          <button
            data-testid="import-templates-close-btn"
            onClick={onClose}
            className="transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div data-testid="import-templates-skeleton" className="space-y-3">
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
            <div className="space-y-3">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedId === template.id}
                  onToggle={() => handleSelect(template.id)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!templates || templates.length === 0) && (
            <div
              data-testid="import-templates-empty"
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
              data-testid="import-templates-cancel-btn"
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
              data-testid="import-templates-import-btn"
              onClick={handleImport}
              disabled={!selectedId}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 12,
              }}
            >
              <Download size={16} />
              Continue
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
      data-testid={`import-template-card-${template.id}`}
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