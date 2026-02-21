export interface ApiResponse<T = unknown> {
  data: T
  meta?: {
    cursor?: string
    total?: number
    [key: string]: unknown
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError
