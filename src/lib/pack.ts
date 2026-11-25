/** Pack JSON into a short, URL- and chat-safe string: 'z…' = deflate-compressed, 'j…' = plain base64url. */

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>))
  return new Uint8Array(await out.arrayBuffer())
}

const toB64 = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function packJSON(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  try {
    if (typeof CompressionStream !== 'undefined') return 'z' + toB64(await pipe(bytes, new CompressionStream('deflate-raw')))
  } catch {
    /* fall through to the plain form */
  }
  return 'j' + toB64(bytes)
}

export async function unpackJSON<T>(packed: string): Promise<T | null> {
  try {
    const body = fromB64(packed.slice(1))
    const bytes = packed[0] === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}
