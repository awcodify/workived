import { describe, it, expect } from 'vitest'

describe('InviteAcceptPage route module', () => {
  it('exports a Route object with a component', async () => {
    const mod = await import('./route')
    expect(mod.Route).toBeDefined()
    expect(mod.Route.options.component).toBeDefined()
    expect(typeof mod.Route.options.component).toBe('function')
  })

  it('has search validation for token param', async () => {
    const mod = await import('./route')
    expect(mod.Route.options.validateSearch).toBeDefined()
  })
})
