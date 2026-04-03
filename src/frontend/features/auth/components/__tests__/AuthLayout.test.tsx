import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from '../AuthLayout'

describe('AuthLayout', () => {
  it('renders three spotlight layers behind the auth shell', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout>
          <div>auth-content</div>
        </AuthLayout>
      </MemoryRouter>,
    )

    expect(screen.getByText('AI TALKSHOW')).toBeTruthy()
    expect(screen.getByText('auth-content')).toBeTruthy()
    expect(container.querySelectorAll('[data-testid^="auth-spotlight-"]').length).toBe(3)
    expect(container.querySelector('.auth-spotlight-1')).toBeTruthy()
    expect(container.querySelector('.auth-spotlight-2')).toBeTruthy()
    expect(container.querySelector('.auth-spotlight-3')).toBeTruthy()
  })
})
