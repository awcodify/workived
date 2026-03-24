import { useState } from 'react'
import { Clock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { WorkScheduleTemplate, CustomScheduleInput } from '@/types/api'
import { colors } from '@/design/tokens'

interface WorkScheduleStepProps {
  templates: WorkScheduleTemplate[]
  selected?: WorkScheduleTemplate
  customSchedule?: CustomScheduleInput
  onNext: (selection: {
    selectedWorkScheduleTemplate?: WorkScheduleTemplate
    customSchedule?: CustomScheduleInput
  }) => void
  onBack: () => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WorkScheduleStep({
  templates,
  selected,
  customSchedule: initialCustom,
  onNext,
  onBack,
}: WorkScheduleStepProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WorkScheduleTemplate | undefined>(
    selected,
  )
  const [showCustom, setShowCustom] = useState(!!initialCustom && !selected)
  const [customSchedule, setCustomSchedule] = useState<CustomScheduleInput>(
    initialCustom || {
      name: '',
      work_days: [1, 2, 3, 4, 5],
      start_time: '09:00',
      end_time: '18:00',
    },
  )

  const handleTemplateSelect = (template: WorkScheduleTemplate) => {
    setSelectedTemplate(template)
    setShowCustom(false)
  }

  const handleCustomToggle = () => {
    setShowCustom(!showCustom)
    if (!showCustom) {
      setSelectedTemplate(undefined)
    }
  }

  const handleDayToggle = (dayIndex: number) => {
    const days = customSchedule.work_days.includes(dayIndex)
      ? customSchedule.work_days.filter((d) => d !== dayIndex)
      : [...customSchedule.work_days, dayIndex].sort()
    setCustomSchedule({ ...customSchedule, work_days: days })
  }

  const canProceed = showCustom
    ? customSchedule.name.trim().length > 0 && customSchedule.work_days.length > 0
    : !!selectedTemplate

  const handleNext = () => {
    if (showCustom) {
      onNext({ customSchedule })
    } else {
      onNext({ selectedWorkScheduleTemplate: selectedTemplate })
    }
  }

  return (
    <div>
      <div className="mb-10 text-center">
        <div 
          className="mb-4 inline-flex h-16 w-16 items-center justify-center"
          style={{ borderRadius: 16, background: colors.accentDim }}
        >
          <Clock className="h-8 w-8" style={{ color: colors.accent }} />
        </div>
        <h2 className="mb-3 text-4xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em' }}>
          Work Schedule
        </h2>
        <p className="text-base" style={{ color: colors.ink500 }}>
          Choose a template or create a custom schedule
        </p>
      </div>

      {!showCustom && (
        <div className="mb-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {templates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="text-left transition-all hover:shadow-md"
                  style={{
                    borderRadius: 18,
                    border: `2px solid ${isSelected ? colors.accent : colors.ink150}`,
                    background: isSelected ? colors.accentDim : colors.ink0,
                    padding: '22px 24px',
                    boxShadow: isSelected ? '0 4px 14px 0 rgba(99,87,232,0.15)' : '0 1px 8px 0 rgba(0,0,0,0.04)',
                  }}
                >
                  <h3 className="mb-2 text-base font-semibold" style={{ color: colors.ink900 }}>
                    {template.name}
                  </h3>
                  <p className="mb-3 text-sm" style={{ color: colors.ink500 }}>
                    {template.description}
                  </p>
                  <div className="flex items-center gap-3 text-sm font-medium" style={{ color: colors.ink700 }}>
                    <span>{template.work_days.map((d) => DAYS[d - 1]).join(', ')}</span>
                    <span style={{ color: colors.ink300 }}>•</span>
                    <span>{template.start_time} - {template.end_time}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleCustomToggle}
            className="mt-6 flex items-center gap-2 font-medium transition-opacity hover:opacity-70"
            style={{ color: colors.accent }}
          >
            <Plus className="h-5 w-5" />
            Create custom schedule
          </button>
        </div>
      )}

      {showCustom && (
        <div 
          className="mb-8"
          style={{
            borderRadius: 18,
            border: `1px solid ${colors.ink150}`,
            background: colors.ink0,
            padding: '28px',
            boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
          }}
        >
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold" style={{ color: colors.ink700 }}>
              Schedule Name
            </label>
            <input
              type="text"
              value={customSchedule.name}
              onChange={(e) => setCustomSchedule({ ...customSchedule, name: e.target.value })}
              placeholder="e.g., Flexible Hours"
              className="w-full px-4 py-3 text-base"
              style={{
                borderRadius: 12,
                border: `1px solid ${colors.ink150}`,
                background: colors.ink0,
                color: colors.ink900,
              }}
            />
          </div>

          <div className="mb-6">
            <label className="mb-3 block text-sm font-semibold" style={{ color: colors.ink700 }}>
              Work Days
            </label>
            <div className="flex gap-2">
              {DAYS.map((day, index) => {
                const isActive = customSchedule.work_days.includes(index + 1)
                return (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(index + 1)}
                    className="flex h-12 w-12 items-center justify-center text-sm font-bold transition-all"
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${isActive ? colors.accent : colors.ink150}`,
                      background: isActive ? colors.accent : colors.ink0,
                      color: isActive ? colors.ink0 : colors.ink700,
                    }}
                  >
                    {day[0]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold" style={{ color: colors.ink700 }}>
                Start Time
              </label>
              <input
                type="time"
                value={customSchedule.start_time}
                onChange={(e) =>
                  setCustomSchedule({ ...customSchedule, start_time: e.target.value })
                }
                className="w-full px-4 py-3 text-base"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${colors.ink150}`,
                  background: colors.ink0,
                  color: colors.ink900,
                }}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold" style={{ color: colors.ink700 }}>
                End Time
              </label>
              <input
                type="time"
                value={customSchedule.end_time}
                onChange={(e) =>
                  setCustomSchedule({ ...customSchedule, end_time: e.target.value })
                }
                className="w-full px-4 py-3 text-base"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${colors.ink150}`,
                  background: colors.ink0,
                  color: colors.ink900,
                }}
              />
            </div>
          </div>

          <button
            onClick={handleCustomToggle}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: colors.ink500 }}
          >
            ← Back to templates
          </button>
        </div>
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
