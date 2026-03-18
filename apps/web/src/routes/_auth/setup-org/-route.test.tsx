import { describe, it, expect } from 'vitest'

describe('SetupOrgPage route module', () => {
  it('exports a Route object with a component', async () => {
    const mod = await import('./route')
    expect(mod.Route).toBeDefined()
    expect(mod.Route.options.component).toBeDefined()
    expect(typeof mod.Route.options.component).toBe('function')
  })

  it('has a beforeLoad guard', async () => {
    const mod = await import('./route')
    expect(typeof mod.Route.options.beforeLoad).toBe('function')
  })
})
