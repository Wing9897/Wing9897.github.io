export type HttpBatchRequest = {
  method?: string
  url: string
  headers?: HeadersInit
  body?: BodyInit | null
}

export type HttpBatchProgress = {
  index: number
  total: number
  ok: boolean
  status: number
  bodyText: string
  error?: string
}

export type HttpBatchOptions = {
  concurrency?: number
  signal?: AbortSignal
  onProgress?: (item: HttpBatchProgress) => void
}

function errorMessage(error: unknown, signal?: AbortSignal): string {
  if (signal?.aborted) return '已中止'
  if (error instanceof DOMException && error.name === 'AbortError') return '已中止'
  if (error instanceof Error) return error.message
  return String(error)
}

async function runOne(
  request: HttpBatchRequest,
  index: number,
  total: number,
  signal?: AbortSignal,
): Promise<HttpBatchProgress> {
  try {
    const response = await fetch(request.url, {
      method: request.method ?? 'GET',
      headers: request.headers,
      body: request.body,
      signal,
    })
    const bodyText = await response.text()
    return {
      index,
      total,
      ok: response.ok,
      status: response.status,
      bodyText,
    }
  } catch (error) {
    return {
      index,
      total,
      ok: false,
      status: 0,
      bodyText: '',
      error: errorMessage(error, signal),
    }
  }
}

export async function runHttpBatch(
  requests: readonly HttpBatchRequest[],
  options: HttpBatchOptions = {},
): Promise<HttpBatchProgress[]> {
  const total = requests.length
  if (total === 0) return []

  const { signal, onProgress } = options
  const concurrency = Math.max(1, options.concurrency ?? 4)
  const results: HttpBatchProgress[] = new Array(total)
  let next = 0

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return
      const index = next
      next += 1
      if (index >= total) return
      const request = requests[index]
      if (!request) return
      const item = await runOne(request, index, total, signal)
      results[index] = item
      onProgress?.(item)
    }
  }

  const workers = Math.min(concurrency, total)
  await Promise.all(Array.from({ length: workers }, () => worker()))

  for (let index = 0; index < total; index += 1) {
    if (results[index]) continue
    const missed: HttpBatchProgress = {
      index,
      total,
      ok: false,
      status: 0,
      bodyText: '',
      error: signal?.aborted ? '已中止' : '未執行',
    }
    results[index] = missed
    onProgress?.(missed)
  }

  return results
}
