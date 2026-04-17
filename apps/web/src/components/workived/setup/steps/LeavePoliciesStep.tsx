import { useState } from 'react'
import { Umbrella, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import type {
  LeavePolicyTemplate,
  LeavePolicyCustomization,
} from '@/types/api'
import { colors } from '@/design/tokens'

interface LeavePoliciesStepProps {
  templates: LeavePolicyTemplate[]
  selected: LeavePolicyTemplate[]
  customizations: Record<string, LeavePolicyCustomization>
  onNext: (selection: {
    selectedLeavePolicies: LeavePolicyTemplate[]
    leavePolicyCustomizations: Record<string, LeavePolicyCustomization>
  }) => void
  onBack: () => void
}

export function LeavePoliciesStep({
  templates,
  selected: initialSelected,
  customizations: initialCustomizations,
  onNext,
  onBack,
}: LeavePoliciesStepProps) {
  const [selected, setSelected] = useState<LeavePolicyTemplate[]>(initialSelected)
  const [customizations, setCustomizations] = useState<Record<string, LeavePolicyCustomization>>(
    initialCustomizations,
  )
  const [customizing, setCustomizing] = useState<string | null>(null)

  const toggleSelection = (template: LeavePolicyTemplate) => {
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

  const handleCustomize = (templateId: string, days: number) => {
    setCustomizations({
      ...customizations,
      [templateId]: { days_per_year: days },
    })
    setCustomizing(null)
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
    onNext({ selectedLeavePolicies: selected, leavePolicyCustomizations: customizations })
  }

  const canProceed = selected.length > 0
  const allSelected = selected.length === templates.length

  return (
    <div data-testid="leave-policies-step">
      <div className="mb-10 text-center">
        <div 
          className="mb-4 inline-flex h-16 w-16 items-center justify-center"
          style={{ borderRadius: 16, background: colors.accentDim }}
        >
          <Umbrella className="h-8 w-8" style={{ color: colors.accent }} />
        </div>
        <h2 className="mb-3 text-4xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em' }}>
          Leave Policies
        </h2>
        <p className="text-base" style={{ color: colors.ink500 }}>
          Select the leave types your organization offers (pick at least one)
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: colors.ink700 }}>
          {selected.length} of {templates.length} selected
        </p>
        <button
          data-testid="leave-policies-select-all-btn"
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
          const customDays = customizations[template.id]?.days_per_year

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
                  data-testid={`leave-policy-checkbox-${template.id}`}
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
                          {customDays ?? template.entitled_days_per_year} days/year
                          {customDays && <span style={{ color: colors.accent, marginLeft: 4 }}>*</span>}
                        </p>
                        <p className="text-xs" style={{ color: colors.ink500 }}>
                          {template.is_carry_over_allowed && `Carry over: ${template.max_carry_over_days} days`}
                          {!template.is_carry_over_allowed && 'No carry over'}
                        </p>
                      </div>
                      <button
                        data-testid={`leave-policy-customize-btn-${template.id}`}
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
                        title="Customize days"
                      >
                        <Settings2 className="h-5 w-5" />
                      </button>
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
                      Customize days per year
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const currentValue = customDays ?? template.entitled_days_per_year
                          if (currentValue > 1) {
                            handleCustomize(template.id, currentValue - 1)
                          }
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
                        data-testid={`leave-policy-days-input-${template.id}`}
                        type="number"
                        value={customDays ?? template.entitled_days_per_year}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1
                          if (value >= 1 && value <= 365) {
                            handleCustomize(template.id, value)
                          }
                        }}
                        min={1}
                        max={365}
                        className="w-20 px-3 py-2 text-center text-base font-semibold"
                        style={{
                          borderRadius: 8,
                          border: `2px solid ${colors.accent}`,
                          background: colors.ink0,
                          color: colors.ink900,
                        }}
                      />
                      <button
                        onClick={() => {
                          const currentValue = customDays ?? template.entitled_days_per_year
                          if (currentValue < 365) {
                            handleCustomize(template.id, currentValue + 1)
                          }
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
          Please select at least one leave policy
        </p>
      )}

      <div className="flex justify-between">
        <button
          data-testid="leave-policies-back-btn"
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
          data-testid="leave-policies-next-btn"
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
