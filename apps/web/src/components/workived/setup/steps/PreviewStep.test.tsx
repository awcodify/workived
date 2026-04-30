import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewStep } from './PreviewStep'
import type { WizardState } from '../SetupWizard'
import type { SetupTemplatesResponse } from '@/types/api'

const emptyTemplates: SetupTemplatesResponse = {
  work_schedules: [],
  leave_policies: [],
  claim_categories: [],
}

function baseState(): WizardState {
  return {
    selectedLeavePolicies: [],
    leavePolicyCustomizations: {},
    selectedClaimCategories: [],
    claimCategoryCustomizations: {},
  }
}

describe('PreviewStep', () => {
  it('renders review heading', () => {
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )
    expect(screen.getByText('Review Your Setup')).toBeInTheDocument()
  })

  it('shows "Not selected" when no work schedule chosen', () => {
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )
    expect(screen.getByText('Not selected')).toBeInTheDocument()
  })

  it('shows template name and formatted work days', () => {
    const state = {
      ...baseState(),
      selectedWorkScheduleTemplate: {
        id: 'tpl-1',
        country_code: 'ID',
        name: 'Indonesia Standard',
        description: '',
        work_days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00',
        sort_order: 1,
      },
    }

    render(
      <PreviewStep
        wizardState={state}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText('Indonesia Standard')).toBeInTheDocument()
    expect(screen.getByText('Mon, Tue, Wed, Thu, Fri')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument()
  })

  it('shows custom schedule name and formatted days', () => {
    const state = {
      ...baseState(),
      customSchedule: {
        name: 'Half Week',
        work_days: [1, 3, 5],
        start_time: '08:00',
        end_time: '14:00',
      },
    }

    render(
      <PreviewStep
        wizardState={state}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText('Half Week')).toBeInTheDocument()
    expect(screen.getByText('Mon, Wed, Fri')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 14:00')).toBeInTheDocument()
  })

  it('shows leave policies with customized days', () => {
    const state: WizardState = {
      ...baseState(),
      selectedLeavePolicies: [
        {
          id: 'lp-1',
          country_code: 'ID',
          name: 'Annual Leave',
          entitled_days_per_year: 12,
          is_carry_forward: false,
          max_carry_forward_days: 0,
          is_unlimited: false,
          gender: null,
          sort_order: 1,
        },
      ],
      leavePolicyCustomizations: {
        'lp-1': { days_per_year: 15 },
      },
    }

    render(
      <PreviewStep
        wizardState={state}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('15 days per year')).toBeInTheDocument()
  })

  it('shows "No leave policies selected" when empty', () => {
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )
    expect(screen.getByText('No leave policies selected')).toBeInTheDocument()
  })

  it('requires two clicks to confirm (safety)', () => {
    const onConfirm = vi.fn()
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    const finishBtn = screen.getByText('Finish!')
    fireEvent.click(finishBtn)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Sure?')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sure?'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows IDR claim limit formatted (no subunit division)', () => {
    const state: WizardState = {
      ...baseState(),
      selectedClaimCategories: [
        {
          id: 'cc-1',
          name: 'Medical',
          description: '',
          monthly_limit: 5200,
          currency_code: 'IDR',
          budget_period: 'monthly',
          requires_receipt: false,
          sort_order: 1,
          country_code: 'ID',
        },
      ],
      claimCategoryCustomizations: {
        'cc-1': { monthly_limit: 5200 },
      },
    }

    render(
      <PreviewStep
        wizardState={state}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    // formatMoney(5200, 'IDR') → "IDR 5,200" (IDR divisor = 1)
    expect(screen.getByText(/IDR 5,200/)).toBeInTheDocument()
  })

  it('shows AED claim limit in main units (divides fils by 100)', () => {
    const state: WizardState = {
      ...baseState(),
      selectedClaimCategories: [
        {
          id: 'cc-2',
          name: 'Transport',
          description: '',
          monthly_limit: 50000,
          currency_code: 'AED',
          budget_period: 'monthly',
          requires_receipt: false,
          sort_order: 1,
          country_code: 'AE',
        },
      ],
      claimCategoryCustomizations: {
        'cc-2': { monthly_limit: 50000 },
      },
    }

    render(
      <PreviewStep
        wizardState={state}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={false}
      />,
    )

    // formatMoney(50000, 'AED') → "AED 500.00" (50000 fils / 100 = AED 500)
    expect(screen.getByText(/AED 500\.00/)).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={onBack}
        isSubmitting={false}
      />,
    )

    fireEvent.click(screen.getByText('Back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows submitting state', () => {
    render(
      <PreviewStep
        wizardState={baseState()}
        templates={emptyTemplates}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        isSubmitting={true}
      />,
    )
    expect(screen.getByText('Submitting...')).toBeInTheDocument()
  })
})
