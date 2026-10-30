const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58Encode(buffer: Uint8Array): string {
  let digits = [0]
  for (let i = 0; i < buffer.length; i += 1) {
    let carry = buffer[i] ?? 0
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] ?? 0) << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  let zeros = 0
  while (zeros < buffer.length && buffer[zeros] === 0) zeros += 1
  let result = ALPHABET[0].repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += ALPHABET[digits[i] ?? 0]
  }
  return result
}

export type SignatureBytes = string | Uint8Array | number[]

export function signatureBase58(signature: SignatureBytes): string {
  if (typeof signature === 'string') return signature
  if (signature instanceof Uint8Array) return base58Encode(signature)
  return base58Encode(Uint8Array.from(signature))
}

/** 字串簽名沿用原頁 `new Uint8Array(string)`：每個字元變成 0x00。 */
export function signatureHex(signature: SignatureBytes): string {
  if (typeof signature === 'string') {
    return `0x${'00'.repeat(signature.length)}`
  }
  const bytes = signature instanceof Uint8Array ? signature : Uint8Array.from(signature)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}
