import type { ScreenshotDraft } from '@/features/private-chat/components/ScreenshotCropper'

let html2canvasLoader: Promise<typeof import('html2canvas').default> | null = null

function loadHtml2Canvas() {
  if (!html2canvasLoader) {
    html2canvasLoader = import('html2canvas').then((module) => module.default)
  }

  return html2canvasLoader
}

export function preloadCaptureDisplayFrame() {
  void loadHtml2Canvas()
}

export async function captureDisplayFrame(): Promise<ScreenshotDraft | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持页面截图。')
  }

  const html2canvas = await loadHtml2Canvas()
  const canvas = await html2canvas(document.body, {
    backgroundColor: null,
    // Let the browser render the cloned DOM directly so modern Tailwind color
    // functions like `color-mix(... in oklab ...)` do not trip html2canvas's
    // legacy CSS parser during capture.
    foreignObjectRendering: true,
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    mimeType: 'image/png',
    fileName: `forum-screenshot-${Date.now()}.png`,
  }
}
