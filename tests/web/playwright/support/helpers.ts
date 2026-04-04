import { expect, type Page, type Request, type Route } from '@playwright/test'
import type { Agent, Community, Notification } from '../../../../src/frontend/api/types'
import type { UserProfile } from '../../../../src/frontend/api/auth'
import { FIXED_TIME_ISO, buildCommunity, buildUser } from './mock-data'

type MatchInput = {
  method: string
  pathname: string
  searchParams: URLSearchParams
  request: Request
}

type MatchRule = string | RegExp | ((input: MatchInput) => boolean)

export interface ApiRouteContext {
  route: Route
  request: Request
  pathname: string
  searchParams: URLSearchParams
}

export interface ApiRouteHandler {
  method?: string
  match: MatchRule
  handle: (context: ApiRouteContext) => Promise<void> | void
}

export interface CommonAppMocks {
  auth: { user: UserProfile } | null
  communities?: Community[]
  myAgents?: Agent[]
  notifications?: Notification[]
}

const STABLE_STYLE = `
  *,
  *::before,
  *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }

  html {
    scroll-behavior: auto !important;
  }
`

export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export async function prepareVisualPage(page: Page) {
  await page.addInitScript(({ fixedNow }) => {
    const fixedMs = new Date(fixedNow).getTime()
    const RealDate = Date

    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixedMs)
          return
        }
        super(...args)
      }

      static now() {
        return fixedMs
      }
    }

    MockDate.parse = RealDate.parse
    MockDate.UTC = RealDate.UTC
    Object.setPrototypeOf(MockDate, RealDate)
    Math.random = () => 0.123456789

    // @ts-expect-error Test harness replaces Date with a frozen clock.
    globalThis.Date = MockDate

    const theme =
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'default.dark'
        : 'default.light'
    window.localStorage.removeItem('agent-modal-state')
    document.documentElement.dataset.theme = theme
  }, { fixedNow: FIXED_TIME_ISO })
}

export async function installApiMocks(
  page: Page,
  common: CommonAppMocks,
  handlers: ApiRouteHandler[] = [],
) {
  const commonHandlers: ApiRouteHandler[] = [
    {
      method: 'GET',
      match: '/auth/me',
      handle: ({ route }) => {
        if (!common.auth) {
          return fulfillError(route, 401, 'AUTH_REQUIRED', 'Authentication required')
        }
        return fulfillOk(route, { user: common.auth.user })
      },
    },
    {
      method: 'GET',
      match: '/communities',
      handle: ({ route }) => fulfillOk(route, common.communities ?? defaultCommunities()),
    },
    {
      method: 'GET',
      match: '/me/agents',
      handle: ({ route }) => fulfillOk(route, common.myAgents ?? []),
    },
    {
      method: 'GET',
      match: '/me/notifications',
      handle: ({ route }) =>
        fulfillOk(route, {
          items: common.notifications ?? [],
          next_cursor: null,
          unread_count: (common.notifications ?? []).filter((item) => !item.read).length,
        }),
    },
    {
      method: 'GET',
      match: '/feed',
      handle: ({ route }) => fulfillOk(route, [], { meta: { cursor: null } }),
    },
  ]

  await page.route('**/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname.replace(/^\/v1/, '')
    const input: MatchInput = {
      method: request.method(),
      pathname,
      searchParams: url.searchParams,
      request,
    }

    for (const handler of [...handlers, ...commonHandlers]) {
      const methodMatches = !handler.method || handler.method === input.method
      if (!methodMatches || !matches(handler.match, input)) {
        continue
      }

      await handler.handle({
        route,
        request,
        pathname,
        searchParams: url.searchParams,
      })
      return
    }

    throw new Error(`Unhandled API request: ${input.method} ${pathname}${url.search}`)
  })
}

export async function gotoAppPage(
  page: Page,
  path: string,
  auth: CommonAppMocks['auth'],
) {
  const bootResponses = [
    waitForApiResponse(page, 'GET', '/auth/me'),
    waitForApiResponse(page, 'GET', '/communities'),
  ]

  if (auth) {
    bootResponses.push(waitForApiResponse(page, 'GET', '/me/agents'))
    bootResponses.push(waitForApiResponse(page, 'GET', '/me/notifications'))
  }

  await page.goto(path)
  await Promise.all(bootResponses)
  await expect(page.getByTestId('app-shell')).toBeVisible()
}

export async function waitForApiResponse(page: Page, method: string, pathname: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === method && url.pathname === `/v1${pathname}`
  })
}

export async function expectPageSnapshot(
  page: Page,
  name: string,
  options: {
    fullPage?: boolean
    maxDiffPixels?: number
  } = {},
) {
  await stabilizeVisualSnapshot(page)
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: options.fullPage ?? false,
    maxDiffPixels: options.maxDiffPixels,
  })
}

export async function stabilizeVisualSnapshot(page: Page) {
  await page.evaluate(async (stableStyle) => {
    function waitForImageSettled(image: HTMLImageElement) {
      if (image.complete) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        const finish = () => resolve()
        image.addEventListener('load', finish, { once: true })
        image.addEventListener('error', finish, { once: true })
        window.setTimeout(finish, 1500)
      })
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const shellContent = document.querySelector<HTMLElement>('[data-testid="app-shell-content"]')
    if (shellContent) {
      shellContent.scrollTop = 0
      shellContent.scrollLeft = 0
    }

    const existing = document.getElementById('visual-regression-stabilizer')
    const styleElement = existing ?? document.createElement('style')
    styleElement.id = 'visual-regression-stabilizer'
    styleElement.textContent = stableStyle
    if (!existing) {
      document.head.append(styleElement)
    }

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))

    if ('fonts' in document) {
      await document.fonts.ready
    }

    const images = Array.from(document.images)
    await Promise.all(images.map((image) => waitForImageSettled(image)))
    await Promise.all(images.map(async (image) => {
      if (image.naturalWidth === 0 || typeof image.decode !== 'function') {
        return
      }
      try {
        await image.decode()
      } catch {
        // Ignore decode failures for broken or unsupported images.
      }
    }))
  }, STABLE_STYLE)
}

export async function fulfillOk(
  route: Route,
  data: unknown,
  init: {
    status?: number
    meta?: Record<string, unknown>
    delayMs?: number
  } = {},
) {
  if (init.delayMs) {
    await new Promise((resolve) => setTimeout(resolve, init.delayMs))
  }

  await route.fulfill({
    status: init.status ?? 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      data,
      ...(init.meta ? { meta: init.meta } : {}),
    }),
  })
}

export async function fulfillError(
  route: Route,
  status: number,
  code: string,
  message: string,
) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      error: {
        code,
        message,
      },
    }),
  })
}

export function defaultCommunities() {
  return [
    buildCommunity(),
    buildCommunity({
      id: 'community-2',
      name: '漫游观察室',
      slug: 'wandering-lab',
      description: '适合把零散感受慢慢拼起来。',
    }),
  ]
}

export function defaultAuthenticatedState() {
  return {
    auth: { user: buildUser() },
    communities: defaultCommunities(),
    myAgents: [],
    notifications: [],
  }
}

function matches(rule: MatchRule, input: MatchInput) {
  if (typeof rule === 'string') {
    return input.pathname === rule
  }
  if (rule instanceof RegExp) {
    return rule.test(input.pathname)
  }
  return rule(input)
}
