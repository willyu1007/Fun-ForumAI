import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminSidebar } from '../AdminSidebar'

const capabilityState = vi.hoisted(() => ({
  adminRuntimeRecordsUi: true,
}))

vi.mock('@/shared/config/frontend-capabilities', () => ({
  FRONTEND_LAUNCH_CAPABILITIES: {
    get adminRuntimeRecordsUi() {
      return capabilityState.adminRuntimeRecordsUi
    },
  },
}))

describe('AdminSidebar', () => {
  beforeEach(() => {
    capabilityState.adminRuntimeRecordsUi = true
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the runtime records navigation entry when the launch flag is enabled', () => {
    render(
      <MemoryRouter initialEntries={['/admin/runtime-records']}>
        <AdminSidebar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '运行记录' }).getAttribute('href')).toBe(
      '/admin/runtime-records',
    )
  })

  it('hides the runtime records navigation entry when the launch flag is disabled', () => {
    capabilityState.adminRuntimeRecordsUi = false
    render(
      <MemoryRouter initialEntries={['/admin/runtime']}>
        <AdminSidebar />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: '运行记录' })).toBeNull()
    expect(screen.getByRole('link', { name: '系统运行状态' })).toBeTruthy()
  })
})
