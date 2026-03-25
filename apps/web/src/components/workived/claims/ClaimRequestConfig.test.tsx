import { describe, it, expect } from 'vitest'
import { formatClaimAmount, createClaimRequestConfig } from './ClaimRequestConfig'
import { render } from '@testing-library/react'
import type { ClaimWithDetails, ClaimBalanceWithCategory } from '@/types/api'
import type { RequestData } from '@/components/workived/shared/requests'

// ── formatClaimAmount ──────────────────────────────────────────

describe('formatClaimAmount', () => {
  it('formats IDR without decimals', () => {
    const result = formatClaimAmount(500000, 'IDR')
    expect(result).toMatch(/500,000/)
    expect(result).toMatch(/Rp|IDR/)
  })

  it('formats AED', () => {
    const result = formatClaimAmount(200, 'AED')
    expect(result).toMatch(/AED/)
    expect(result).toMatch(/200/)
  })

  it('formats MYR', () => {
    const result = formatClaimAmount(1500, 'MYR')
    expect(result).toMatch(/MYR|RM/)
    expect(result).toMatch(/1,500|1500/)
  })

  it('formats SGD', () => {
    const result = formatClaimAmount(300, 'SGD')
    expect(result).toMatch(/SGD/)
    expect(result).toMatch(/300/)
  })
})

// ── helpers ────────────────────────────────────────────────────

function makeClaim(amount: number, currency: string): ClaimWithDetails {
  return {
    id: 'c1',
    organisation_id: 'org1',
    employee_id: 'emp1',
    employee_name: 'Alice',
    category_id: 'cat1',
    category_name: 'Meals',
    amount,
    currency_code: currency,
    description: '',
    claim_date: '2026-03-20',
    status: 'approved',
    created_at: '',
    updated_at: '',
  }
}

// ── createClaimRequestConfig — getRightContent ─────────────────

describe('createClaimRequestConfig getRightContent', () => {
  it('shows AED amount (not Rp) for AED claims', () => {
    const config = createClaimRequestConfig()
    const getRightContent = config.getRightContent!
    const { container } = render(
      <>{getRightContent(makeClaim(150, 'AED') as unknown as RequestData, 'my')}</>
    )
    expect(container.textContent).toMatch(/AED|150/)
    expect(container.textContent).not.toMatch(/^Rp/)
  })

  it('shows Rp for IDR claims', () => {
    const config = createClaimRequestConfig()
    const getRightContent = config.getRightContent!
    const { container } = render(
      <>{getRightContent(makeClaim(250000, 'IDR') as unknown as RequestData, 'my')}</>
    )
    expect(container.textContent).toMatch(/Rp/)
  })

  it('shows compact M format for large IDR amounts', () => {
    const config = createClaimRequestConfig()
    const getRightContent = config.getRightContent!
    const { container } = render(
      <>{getRightContent(makeClaim(1_500_000, 'IDR') as unknown as RequestData, 'my')}</>
    )
    expect(container.textContent).toMatch(/1\.5M/)
  })

  it('shows compact K format for thousands IDR', () => {
    const config = createClaimRequestConfig()
    const getRightContent = config.getRightContent!
    const { container } = render(
      <>{getRightContent(makeClaim(50_000, 'IDR') as unknown as RequestData, 'my')}</>
    )
    expect(container.textContent).toMatch(/50K/)
  })
})

// ── createClaimRequestConfig — getSummaryText ──────────────────

describe('createClaimRequestConfig getSummaryText', () => {
  it('sums amounts and shows AED currency', () => {
    const config = createClaimRequestConfig()
    const requests = [
      makeClaim(100, 'AED'),
      makeClaim(50, 'AED'),
    ] as unknown as RequestData[]
    const result = config.getSummaryText!(requests)
    expect(result).toMatch(/150/)
    expect(result).toMatch(/AED/)
  })

  it('falls back to IDR when claims array is empty', () => {
    const config = createClaimRequestConfig()
    const result = config.getSummaryText!([] as unknown as RequestData[])
    expect(result).toMatch(/0/)
  })
})

// ── createClaimRequestConfig — getExtraInfo ────────────────────

describe('createClaimRequestConfig getExtraInfo', () => {
  it('shows budget impact for approval variant with balance', () => {
    const balance: ClaimBalanceWithCategory = {
      id: 'b1',
      organisation_id: 'org1',
      employee_id: 'emp1',
      category_id: 'cat1',
      category_name: 'Meals',
      budget_period: 'monthly',
      year: 2026,
      month: 3,
      total_spent: 0,
      claim_count: 0,
      currency_code: 'AED',
      monthly_limit: 500,
      remaining: 500,
      created_at: '',
      updated_at: '',
    }
    const config = createClaimRequestConfig(balance)
    const { container } = render(
      <>{config.getExtraInfo!(makeClaim(100, 'AED') as unknown as RequestData, 'approval')}</>
    )
    // Budget remaining before: 500, after: 400
    expect(container.textContent).toMatch(/500/)
    expect(container.textContent).toMatch(/400/)
  })

  it('returns null for my-variant', () => {
    const config = createClaimRequestConfig()
    const result = config.getExtraInfo!(makeClaim(100, 'AED') as unknown as RequestData, 'my')
    expect(result).toBeNull()
  })

  it('returns null for approval variant without balance', () => {
    const config = createClaimRequestConfig()
    const result = config.getExtraInfo!(makeClaim(100, 'AED') as unknown as RequestData, 'approval')
    expect(result).toBeNull()
  })
})

// ── createClaimRequestConfig — getTitle / getSubtitle ─────────

describe('createClaimRequestConfig getTitle/getSubtitle', () => {
  it('returns category_name as title', () => {
    const config = createClaimRequestConfig()
    const result = config.getTitle!(makeClaim(100, 'AED') as unknown as RequestData)
    expect(result).toBe('Meals')
  })

  it('returns employee_name as subtitle', () => {
    const config = createClaimRequestConfig()
    const result = config.getSubtitle!(makeClaim(100, 'AED') as unknown as RequestData)
    expect(result).toBe('Alice')
  })
})
