import { useState } from 'react'
import { Receipt, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import type {
  ClaimCategoryTemplate,
  ClaimCategoryCustomization,
} from '@/types/api'
import { colors } from '@/design/tokens'

interface ClaimCategoriesStepProps {
  templates: ClaimCategoryTemplate[]
  selected: ClaimCategoryTemplate[]
  customizations: Record<string, ClaimCategoryCustomization>
  onNext: (selection: {
    selectedClaimCategories: ClaimCategoryTemplate[]
    claimCategoryCustomizations: Record<string, ClaimCategoryCustomization>
  }) => void
  onBack: () => void
}

export function ClaimCategoriesStep({
  templates,
  selected: initialSelected,
  customizations: initialCustomizations,
  onNext,
  onBack,
}: ClaimCategoriesStepProps) {
  const [selected, setSelected] = useState<ClaimCategoryTemplate[]>(initialSelected)
  const [customizations, setCustomizations] = useState<Record<string, ClaimCategoryCustomization>>(
    initialCustomizations,
  )
  const [customizing, setCustomizing] = useState<string | null>(null)

  const toggleSelection = (template: ClaimCategoryTemplate) => {
    if (selected.find((t) => t.id === template.id)) {
      setSelected(selected.filter((t) => t.id !== template.id))
      // Remove customization if exists
      const newCustomizations = { ...customizations }
      delete newCustomizations[template.id]
      setCustomizations(newCustomizations)
    } else {
      setSelected([...selected, template])
    }
  }

  const handleCustomize = (templateId: string, limit: number | null) => {
    if (limit === null) {
      // Remove customization (use template default)
      const newCustomizations = { ...customizations }
      delete newCustomizations[templateId]
      setCustomizations(newCustomizations)
    } else {
      setCustomizations({
        ...customizations,
        [templateId]: { monthly_limit: limit },
      })
    }
    setCustomizing(null)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount / 100) + ' ' + currency
  }

  const handleSelectAll = () => {
    if (selected.length === templates.length) {
      // Deselect all
      setSelected([])
      setCustomizations({})
    } else {
      // Select all
      setSelected([...templates])
    }
  }

  const handleNext = () => {
    onNext({
      selectedClaimCategories: selected,
      claimCategoryCustomizations: customizations,
    })
  }

  const canProceed = selected.length > 0
  const allSelected = selected.length === templates.length

  return (
    <div>
      <div className="mb-10 text-center">
        <div 
          className="mb-4 inline-flex h-16 w-16 items-center justify-center"
          style={{ borderRadius: 16, background: colors.okDim }}
        >
          <Receipt className="h-8 w-8" style={{ color: colors.ok }} />
        </div>
        <h2 className="mb-3 text-4xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em' }}>
          Claim Categories
        </h2>
        <p className="text-base" style={{ color: colors.ink500 }}>
          Choose expense categories employees can claim (pick at least one)
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: colors.ink700 }}>
          {selected.length} of {templates.length} selected
        </p>
        <button
          onClick={handleSelectAll}
          className="text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: colors.accent }}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div
        className="mb-8"
        style={{
          borderRadius: 18,
          border: `1px solid ${colors.ink150}`,
          background: colors.ink0,
          overflow: 'hidden',
          boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
        }}
      >
        {templates.map((template, index) => {
          const isSelected = !!selected.find((t) => t.id === template.id)
          const customLimit = customizations[template.id]?.monthly_limit

          return (
            <div key={template.id}>
              <div
                className="flex items-center gap-4 transition-colors hover:bg-opacity-50"
                style={{
                  padding: '16px 20px',
                  borderTop: index > 0 ? `1px solid ${colors.ink100}` : 'none',
                  background: isSelected ? colors.accentDim : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelection(template)}
                  className="h-5 w-5 cursor-pointer"
                  style={{
                    accentColor: colors.accent,
                    borderRadius: 6,
                  }}
                />
                <div
                  onClick={() => toggleSelection(template)}
                  className="flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="mb-1 text-base font-semibold" style={{ color: colors.ink900 }}>
                        {template.name}
                      </h3>
                      <p className="text-sm" style={{ color: colors.ink500 }}>
                        {template.description}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: colors.ink900 }}>
                          {(customLimit !== undefined ? customLimit : template.monthly_limit) 
                            ? formatCurrency(
                                customLimit ?? template.monthly_limit!,
                                template.currency_code!,
                              ) + '/month'
                            : 'Unlimited'}
                          {customLimit !== undefined && <span style={{ color: colors.accent, marginLeft: 4 }}>*</span>}
                        </p>
                        <p className="text-xs" style={{ color: colors.ink500 }}>
                          {template.requires_receipt ? 'Receipt required' : 'No receipt needed'}
                        </p>
                      </div>
                      {template.monthly_limit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isSelected) {
                              toggleSelection(template)
                            }
                            setCustomizing(template.id)
                          }}
                          className="p-2 transition-all hover:scale-105"
                          style={{ 
                            borderRadius: 8,
                            background: colors.accentDim,
                            color: colors.accent,
                            cursor: 'pointer'
                          }}
                          title="Customize limit"
                        >
                          <Settings2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {customizing === template.id && (
                <div 
                  style={{
                    padding: '16px 20px',
                    borderTop: `1px solid ${colors.ink100}`,
                    background: colors.accentDim,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold" style={{ color: colors.ink900 }}>
                      Customize monthly limit ({template.currency_code})
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const currentValue = (customLimit ?? template.monthly_limit!) / 100
                          const newValue = Math.max(0, currentValue - 10)
                          handleCustomize(template.id, Math.round(newValue * 100))
                        }}
                        className="flex h-8 w-8 items-center justify-center font-bold transition-opacity hover:opacity-70"
                        style={{
                          borderRadius: 8,
                          background: colors.ink0,
                          color: colors.ink900,
                          border: `1px solid ${colors.ink150}`,
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={(customLimit ?? template.monthly_limit!) / 100}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          if (value >= 0) {
                            handleCustomize(template.id, Math.round(value * 100))
                          }
                        }}
                        min={0}
                        step="10"
                        className="w-24 px-3 py-2 text-center text-base font-semibold"
                        style={{
                          borderRadius: 8,
                          border: `2px solid ${colors.accent}`,
                          background: colors.ink0,
                          color: colors.ink900,
                        }}
                      />
                      <button
                        onClick={() => {
                          const currentValue = (customLimit ?? template.monthly_limit!) / 100
                          const newValue = currentValue + 10
                          handleCustomize(template.id, Math.round(newValue * 100))
                        }}
                        className="flex h-8 w-8 items-center justify-center font-bold transition-opacity hover:opacity-70"
                        style={{
                          borderRadius: 8,
                          background: colors.ink0,
                          color: colors.ink900,
                          border: `1px solid ${colors.ink150}`,
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => setCustomizing(null)}
                        className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                        style={{
                          borderRadius: 8,
                          background: colors.accent,
                          color: colors.ink0,
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!canProceed && (
        <p className="mb-4 text-center text-sm font-medium" style={{ color: colors.err }}>
          Please select at least one claim category
        </p>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-8 py-3 font-semibold transition-all hover:bg-opacity-60"
          style={{
            borderRadius: 12,
            border: `1px solid ${colors.ink150}`,
            background: colors.ink0,
            color: colors.ink700,
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-8 py-3 font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.accentMid} 0%, ${colors.accent} 100%)`,
            color: colors.ink0,
            boxShadow: canProceed ? '0 4px 14px 0 rgba(99,87,232,0.25)' : 'none',
          }}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
