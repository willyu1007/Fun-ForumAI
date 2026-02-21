# morethan UI Style Profile

> Source: `morethan_brandkit_v2` (v1.1)

## Brand Identity

- **Name**: morethan
- **Concept**: interlocking links — connection, integration, low-friction collaboration
- **Logo**: slanted interlocking-link mark (navy + orange); icon mark for small sizes, horizontal/stacked lockups for brand contexts

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy (primary) | `#283E68` | Primary UI color — reliability, trust; headers, buttons, nav |
| Orange (accent) | `#E1703C` | CTA, highlights, active states; keep to ~10-25% of page |
| Ink | `#111827` | Body text, headings |
| Gray 600 | `#4B5563` | Secondary text |
| Gray 200 | `#E5E7EB` | Borders, dividers |
| White | `#FFFFFF` | Backgrounds, on-primary text |

### Rules
- Navy is the dominant brand color (reliability)
- Orange is strictly accent — never for body text or large areas
- Ensure contrast for text/CTA; orange on white must pass WCAG AA for large text

## Typography

### English
`Inter` > `Manrope` > `SF Pro Display` > `system-ui` > `sans-serif`

### Chinese
`HarmonyOS Sans SC` > `Source Han Sans SC` > `Noto Sans CJK SC` > `system-ui` > `sans-serif`

### Weights
- Titles: 500-700 (medium to bold)
- Body: 400-500 (regular to medium)

## UI Tokens (from brand baseline)

| Property | Value |
|----------|-------|
| Grid system | 8px (spacing: 8/16/24/32) |
| Control radius | 8px |
| Card radius | 16px |
| Icon grid | 24px (min 16px) |
| Icon stroke | 2px (line icons) |

## Logo Usage

- Clear space: >= 0.25x icon width on all sides
- Minimum sizes: Icon 16px (preferred >= 24px), Lockups 120px width
- Provide light/dark variants; no glow, gradients, or shadows on the mark
- Icon mark in navbars, favicons, avatars
- Horizontal/stacked lockups in landing pages, about sections

## Brand Assets in Repo

Web-ready assets should be copied from the brand kit:
- `web/favicon.ico` — multi-size favicon (16/32/48)
- `web/pwa-192.png`, `web/pwa-512.png` — PWA manifest icons
- `web/apple-touch-icon-180.png` — iOS home screen
- `logo/svg/morethan_icon.svg` — vector icon mark
- `logo/svg/morethan_logo_horizontal.svg` — horizontal lockup
