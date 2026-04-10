import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from '../RouteErrorBoundary'
import { setDynamicImportReloadHandlerForTests } from '../lazy-import-recovery'

const useRouteErrorMock = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useRouteError: () => useRouteErrorMock(),
  }
})

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    useRouteErrorMock.mockReset()
    window.sessionStorage.clear()
    setDynamicImportReloadHandlerForTests(null)
  })

  afterEach(() => {
    window.sessionStorage.clear()
    setDynamicImportReloadHandlerForTests(null)
    vi.restoreAllMocks()
  })

  it('tries a guarded reload for stale dynamic import failures', () => {
    const reload = vi.fn()
    setDynamicImportReloadHandlerForTests(reload)
    useRouteErrorMock.mockReturnValue(
      new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/chunk.js'),
    )

    render(<RouteErrorBoundary />)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByText('页面刚完成更新，正在重新载入…')).toBeTruthy()
  })

  it('shows a manual recovery fallback for non-recoverable errors', () => {
    useRouteErrorMock.mockReturnValue(new Error('Something else blew up'))

    render(<RouteErrorBoundary />)

    expect(screen.getByText('页面加载失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重新加载' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '返回首页' }).getAttribute('href')).toBe('/')
  })
})
