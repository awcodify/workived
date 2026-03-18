import { orgKeys } from '@/lib/hooks/useOrganisation'

describe('orgKeys', () => {
  it('mine returns ["organisation", "mine"]', () => {
    expect(orgKeys.mine).toEqual(['organisation', 'mine'])
  })
})
