export class ApiError extends Error {
  readonly status?: number
  readonly code?: number
  readonly payload?: unknown

  constructor(message: string, opts?: { status?: number; code?: number; payload?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts?.status
    this.code = opts?.code
    this.payload = opts?.payload
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    const text = await res.text()

    if (!res.ok) {
      throw new ApiError(`请求失败: ${res.status}`, { status: res.status, payload: text })
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError('解析响应失败', { status: res.status, payload: text })
    }
  } finally {
    window.clearTimeout(timer)
  }
}

