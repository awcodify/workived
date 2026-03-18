import { describe, it, expect } from 'vitest'

describe('RegisterPage route module', () => {
  it('exports a Route object with a component', async () => {
    const mod = await import('./route')
    expect(mod.Route).toBeDefined()
    expect(mod.Route.options.component).toBeDefined()
    expect(typeof mod.Route.options.component).toBe('function')
  })
})
