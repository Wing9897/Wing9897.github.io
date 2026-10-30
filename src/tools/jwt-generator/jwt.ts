const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(input: string): Uint8Array {
  let value = input.replace(/-/g, '+').replace(/_/g, '/')
  while (value.length % 4) value += '='
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function hmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return base64UrlEncode(new Uint8Array(signature))
}

export function generateRandomSecret(format: 'base64' | 'hex'): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  if (format === 'hex') {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] ?? 0)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const JWT_PATTERN = /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/

export async function generateJwt(secret: string, payloadText: string, expiresIn: string): Promise<string> {
  if (!secret) throw new Error('請先輸入或生成 Secret Key！')
  if (secret.length < 32) throw new Error('Secret key 必須至少 32 個字符！')

  const parsed: unknown = JSON.parse(payloadText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Payload 必須是 JSON 物件')
  }
  const payload = parsed as Record<string, unknown>
  const now = Math.floor(Date.now() / 1000)
  payload.iat = now
  const expiresNumber = Number(expiresIn)
  if (expiresIn && expiresNumber > 0) {
    payload.exp = now + Number.parseInt(expiresIn, 10)
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signature = await hmacSha256(signatureInput, secret)
  return `${signatureInput}.${signature}`
}

export type DecodedJwt = {
  headerRaw: string
  payloadRaw: string
  signature: string
  header: unknown
  payload: unknown
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split('.')
  if (parts.length !== 3) throw new Error('無效的 JWT 格式')
  const [headerRaw, payloadRaw, signature] = parts
  if (!headerRaw || !payloadRaw || signature === undefined) throw new Error('無效的 JWT 格式')
  const header = JSON.parse(decoder.decode(base64UrlDecode(headerRaw))) as unknown
  const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadRaw))) as unknown
  return { headerRaw, payloadRaw, signature, header, payload }
}

export type VerifiedJwt = {
  header: unknown
  payload: unknown
  expired: boolean | null
  remaining: number | null
}

export async function verifyJwt(token: string, secret: string): Promise<VerifiedJwt> {
  const parts = token.trim().split('.')
  if (parts.length !== 3) throw new Error('無效的 JWT 格式')
  const [headerRaw, payloadRaw, signature] = parts
  if (!headerRaw || !payloadRaw || !signature) throw new Error('無效的 JWT 格式')
  const expected = await hmacSha256(`${headerRaw}.${payloadRaw}`, secret)
  if (expected !== signature) {
    throw new Error('簽名驗證失敗！Token 可能被篡改或使用了錯誤的 secret key')
  }
  const header = JSON.parse(decoder.decode(base64UrlDecode(headerRaw))) as unknown
  const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadRaw))) as { exp?: unknown }
  if (!payload || typeof payload !== 'object' || !payload.exp) {
    return { header, payload, expired: null, remaining: null }
  }
  const exp = typeof payload.exp === 'number' ? payload.exp : Number(payload.exp)
  if (!Number.isFinite(exp)) return { header, payload, expired: null, remaining: null }
  const now = Math.floor(Date.now() / 1000)
  if (now > exp) return { header, payload, expired: true, remaining: null }
  return { header, payload, expired: false, remaining: exp - now }
}
