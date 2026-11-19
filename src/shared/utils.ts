import { HASH_ALGORITHM, HEX_BYTE_WIDTH, HEX_RADIX } from './constants'

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'))
    .join('')
}
