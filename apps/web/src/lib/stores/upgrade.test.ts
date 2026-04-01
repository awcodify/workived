import { describe, it, expect, beforeEach } from 'vitest'
import { useUpgradeStore } from './upgrade'

describe('useUpgradeStore', () => {
  beforeEach(() => {
    useUpgradeStore.setState({ open: false, message: '' })
  })

  it('starts closed', () => {
    const state = useUpgradeStore.getState()
    expect(state.open).toBe(false)
    expect(state.message).toBe('')
  })

  it('show opens modal with message', () => {
    useUpgradeStore.getState().show('Employee limit reached')

    const state = useUpgradeStore.getState()
    expect(state.open).toBe(true)
    expect(state.message).toBe('Employee limit reached')
  })

  it('hide closes modal and clears message', () => {
    useUpgradeStore.getState().show('Upgrade needed')
    useUpgradeStore.getState().hide()

    const state = useUpgradeStore.getState()
    expect(state.open).toBe(false)
    expect(state.message).toBe('')
  })
})
