import type { CreateRuntimeOperationRecordInput } from '../repos/types.js'

/**
 * Lightweight indirection layer between runtime/business code and the
 * `RuntimeOperationRecordService`. Runtime classes call
 * `recordRuntimeOperation()` without taking the service through their deps
 * interface; the container wires the recorder once at startup.
 *
 * Design rules (T-301 contract):
 * - The default no-op recorder lets tests run without container wiring.
 * - The recorder MUST never change business behavior. The wrapper here
 *   already swallows synchronous throws; the underlying service's
 *   `record()` swallows persistence errors.
 * - Recording is fire-and-forget — the runtime path never `await`s it.
 *   This avoids adding latency to the hot loop.
 */
export type RuntimeOperationRecorder = (input: CreateRuntimeOperationRecordInput) => void

let activeRecorder: RuntimeOperationRecorder = () => undefined

/** Install the recorder. Called from `src/backend/container/index.ts`. */
export function setRuntimeOperationRecorder(recorder: RuntimeOperationRecorder): void {
  activeRecorder = recorder
}

/** Reset to the default no-op. Tests should call this in afterEach if they install a spy. */
export function resetRuntimeOperationRecorder(): void {
  activeRecorder = () => undefined
}

/**
 * Record an operation event from runtime/business code.
 * Synchronous wrapper that catches its own throws so the caller never
 * needs a try/catch.
 */
export function recordRuntimeOperation(input: CreateRuntimeOperationRecordInput): void {
  try {
    activeRecorder(input)
  } catch (err) {
    // Last-ditch defensive log — do not let observability break business code.
    console.warn(
      `[runtime-observability] recorder threw on ${input.source}/${input.operation}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

/**
 * Best-effort upper bound for `error_message_redacted` at the call site. The
 * service layer applies its own (currently 1KB) truncation+sanitization on
 * top of this, so this helper only exists to keep call-site error strings
 * compact for the common case.
 */
export function compactErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.length > 512 ? `${raw.slice(0, 511)}…` : raw
}
