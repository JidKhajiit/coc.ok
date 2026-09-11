import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export const CLAIM_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024

const uploadsRoot = resolve(process.cwd(), 'uploads')

export function claimScreenshotPublicUrl(claimId: string, ext: string): string {
  return `/uploads/claims/${claimId}${ext}`
}

export function claimScreenshotFilePath(publicUrl: string): string {
  const pathOnly = publicUrl.split('?')[0] ?? publicUrl
  return resolve(uploadsRoot, pathOnly.replace(/^\//, ''))
}

export function extensionForClaimMime(mime: string): string | null {
  return ALLOWED_TYPES[mime] ?? null
}

export function isAllowedClaimMime(mime: string): boolean {
  return mime in ALLOWED_TYPES
}

export async function saveClaimScreenshot(
  mime: string,
  data: Buffer,
): Promise<{ publicUrl: string; claimFileId: string }> {
  const ext = extensionForClaimMime(mime)
  if (!ext) throw new Error('INVALID_TYPE')
  if (data.byteLength === 0 || data.byteLength > CLAIM_SCREENSHOT_MAX_BYTES) {
    throw new Error('INVALID_SIZE')
  }

  const claimFileId = randomUUID()
  const publicUrl = claimScreenshotPublicUrl(claimFileId, ext)
  const filePath = claimScreenshotFilePath(publicUrl)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, data)
  return { publicUrl, claimFileId }
}

export async function deleteClaimScreenshot(publicUrl: string) {
  try {
    await unlink(claimScreenshotFilePath(publicUrl))
  } catch {
    // ignore
  }
}

export function guessMimeFromExt(path: string): string | null {
  const ext = extname(path).toLowerCase()
  for (const [mime, e] of Object.entries(ALLOWED_TYPES)) {
    if (e === ext) return mime
  }
  return null
}
