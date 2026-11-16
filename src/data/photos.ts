/**
 * Meal photos, kept only on this phone. They live outside the main data so
 * they don't slow it down: small JPEG thumbnails in their own localStorage
 * entry, newest 40 kept.
 */
const KEY = 'rasoi:photos:v1'
const MAX = 40

type Store = Record<string, { at: number; url: string }>

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

/** Shrink an image so its longest side is `max` px; returns a JPEG blob. */
export async function shrink(file: Blob, max: number, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That file isn’t a photo we can read'))
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** Save a thumbnail of a meal photo; returns its id, or undefined if this phone's storage is full or blocked. */
export async function savePhoto(file: Blob): Promise<string | undefined> {
  try {
    const url = await toDataUrl(await shrink(file, 360, 0.6))
    const store = read()
    const id = `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    store[id] = { at: Date.now(), url }
    const keep = Object.entries(store)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep)))
    return id
  } catch {
    return undefined
  }
}

export function getPhoto(id: string | undefined): string | undefined {
  return id ? read()[id]?.url : undefined
}
