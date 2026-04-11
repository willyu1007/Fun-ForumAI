jest.mock(
  '@fun-forum/ui-mobile/theme',
  () => ({
    MOBILE_THEMES: {
      'default.light': {},
      'default.dark': {},
    },
    colors: {
      bg: '#ffffff',
      surface: '#f7f7f8',
      border: '#d9d9dd',
      primary: '#2563eb',
      onPrimary: '#ffffff',
      textSecondary: '#5b6472',
      focusRing: '#60a5fa',
      danger: '#dc2626',
      surfaceElevated: '#ffffff',
      textPrimary: '#111827',
      textMuted: '#6b7280',
      borderSubtle: '#e5e7eb',
    },
    spacing: {
      1: 8,
      2: 12,
      3: 16,
      4: 24,
    },
    radius: {
      sm: 8,
      md: 12,
    },
    typography: {
      size: {
        caption: 12,
        body: 14,
        bodyLg: 16,
        h3: 20,
      },
    },
  }),
  { virtual: true },
)

let themeModule: typeof import('../theme')

beforeAll(async () => {
  themeModule = await import('../theme')
})

describe('mobile theme re-export surface', () => {
  it('re-exports the semantic theme surface', () => {
    expect(themeModule.MOBILE_THEMES).toEqual({
      'default.light': {},
      'default.dark': {},
    })
    expect(themeModule.colors.bg).toBe('#ffffff')
    expect(themeModule.spacing[4]).toBe(24)
    expect(themeModule.radius.md).toBe(12)
    expect(themeModule.typography.size.h3).toBe(20)
  })
})
