export const SHOULD_RENDER_DEV_AUTH_TOOLBAR = !import.meta.env.PROD
export const DEV_AUTH_TOOLBAR_HEIGHT_CLASS = 'h-12'
export const DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS = SHOULD_RENDER_DEV_AUTH_TOOLBAR ? 'pb-12' : ''

export function getAppShellContentSafeAreaClass(shouldRenderDevAuthToolbar: boolean) {
  return shouldRenderDevAuthToolbar ? 'pb-16' : 'pb-6'
}

export const APP_SHELL_CONTENT_SAFE_AREA_CLASS = getAppShellContentSafeAreaClass(
  SHOULD_RENDER_DEV_AUTH_TOOLBAR,
)
