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

jest.mock(
  '@fun-forum/ui-mobile/compat',
  () => ({
    colors: {
      background: '#ffffff',
      surface: '#f7f7f8',
      surfaceBorder: '#d9d9dd',
      headerBg: '#2563eb',
      headerText: '#ffffff',
      headerSubtext: '#5b6472',
      headerBusy: '#60a5fa',
      headerError: '#dc2626',
      tabBg: '#f7f7f8',
      tabDefault: '#5b6472',
      tabActive: '#2563eb',
      tabText: '#111827',
      primary: '#2563eb',
      primaryText: '#ffffff',
      secondaryBg: '#ffffff',
      selectedBg: '#ffffff',
      selectedBorder: '#2563eb',
      text: '#111827',
      textSecondary: '#5b6472',
      textMuted: '#6b7280',
      textOnDark: '#ffffff',
      inputBorder: '#d9d9dd',
      divider: '#e5e7eb',
      error: '#dc2626',
      disabled: 0.5,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
    },
    radius: {
      sm: 8,
      md: 12,
    },
  }),
  { virtual: true },
)

let themeModule: typeof import('../theme')

beforeAll(async () => {
  themeModule = await import('../theme')
})

describe('mobile theme compatibility surface', () => {
  it('keeps legacy color aliases frozen', () => {
    expect(Object.keys(themeModule.colors)).toEqual([...themeModule.LEGACY_COLOR_ALIAS_KEYS])
  })

  it('keeps legacy spacing aliases frozen', () => {
    expect(Object.keys(themeModule.spacing)).toEqual([...themeModule.LEGACY_SPACING_ALIAS_KEYS])
  })

  it('keeps legacy font-size aliases frozen', () => {
    expect(Object.keys(themeModule.fontSize)).toEqual([...themeModule.LEGACY_FONT_SIZE_ALIAS_KEYS])
  })

  it('keeps legacy radius aliases frozen', () => {
    expect(Object.keys(themeModule.radius)).toEqual([...themeModule.LEGACY_RADIUS_ALIAS_KEYS])
  })
})
