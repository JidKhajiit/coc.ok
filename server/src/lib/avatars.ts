import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const uploadsRoot = resolve(process.cwd(), 'uploads')

export function getUploadsRoot() {
  return uploadsRoot
}

export function avatarPublicUrl(userId: string, ext: string, version: number): string {
  return `/uploads/avatars/${userId}-${version}${ext}`
}

export function avatarFilePath(publicUrl: string): string {
  const pathOnly = publicUrl.split('?')[0] ?? publicUrl
  return resolve(uploadsRoot, pathOnly.replace(/^\//, ''))
}

export function extensionForMime(mime: string): string | null {
  return ALLOWED_TYPES[mime] ?? null
}

export async function saveAvatarFile(
  userId: string,
  mime: string,
  data: Buffer,
  previousUrl: string | null,
): Promise<string> {
  const ext = extensionForMime(mime)
  if (!ext) {
    throw new Error('INVALID_TYPE')
  }
  if (data.byteLength === 0 || data.byteLength > AVATAR_MAX_BYTES) {
    throw new Error('INVALID_SIZE')
  }

  const publicUrl = avatarPublicUrl(userId, ext, Date.now())
  const filePath = avatarFilePath(publicUrl)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, data)

  if (previousUrl && previousUrl !== publicUrl) {
    await deleteAvatarFile(previousUrl)
  }

  return publicUrl
}

export async function deleteAvatarFile(publicUrl: string) {
  try {
    await unlink(avatarFilePath(publicUrl))
  } catch {
    // Missing file is fine (already replaced / cleaned).
  }
}

export function isAllowedAvatarMime(mime: string): boolean {
  return mime in ALLOWED_TYPES
}

/** Reject path traversal; only `/uploads/avatars/{uuid}-{ts}.{ext}`. */
export function isValidAvatarUrl(url: string): boolean {
  return /^\/uploads\/avatars\/[0-9a-f-]{36}-\d+\.(jpg|png|webp|gif)$/i.test(url)
}

export function guessMimeFromExt(path: string): string | null {
  const ext = extname(path).toLowerCase()
  for (const [mime, e] of Object.entries(ALLOWED_TYPES)) {
    if (e === ext) return mime
  }
  return null
}
