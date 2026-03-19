import { describe, it, expect } from 'vitest'
import { orgKeys } from '@/lib/hooks/useOrganisation'

describe('orgKeys', () => {
  it('mine returns ["organisation", "mine"]', () => {
    expect(orgKeys.mine).toEqual(['organisation', 'mine'])
  })

  it('detail returns ["organisation", "detail"]', () => {
    expect(orgKeys.detail).toEqual(['organisation', 'detail'])
  })

  it('mine key is referentially stable', () => {
    expect(orgKeys.mine).toBe(orgKeys.mine)
  })

  it('detail key is referentially stable', () => {
    expect(orgKeys.detail).toBe(orgKeys.detail)
  })
})
