import { employeeKeys } from '@/lib/hooks/useEmployees'

describe('employeeKeys', () => {
  it('all returns ["employees"]', () => {
    expect(employeeKeys.all).toEqual(['employees'])
  })

  it('me() returns ["employees", "me"]', () => {
    expect(employeeKeys.me()).toEqual(['employees', 'me'])
  })

  it('lists() returns ["employees", "list"]', () => {
    expect(employeeKeys.lists()).toEqual(['employees', 'list'])
  })

  it('list() without params returns ["employees", "list", undefined]', () => {
    expect(employeeKeys.list()).toEqual(['employees', 'list', undefined])
  })

  it('list({ status: "active" }) includes the params', () => {
    const params = { status: 'active' }
    expect(employeeKeys.list(params)).toEqual(['employees', 'list', { status: 'active' }])
  })

  it('details() returns ["employees", "detail"]', () => {
    expect(employeeKeys.details()).toEqual(['employees', 'detail'])
  })

  it('detail("123") returns ["employees", "detail", "123"]', () => {
    expect(employeeKeys.detail('123')).toEqual(['employees', 'detail', '123'])
  })
})
