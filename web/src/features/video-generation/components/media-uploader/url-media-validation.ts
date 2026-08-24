/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { MediaCategory } from '../../profiles/types'

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
])

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'mkv',
  'avi',
  'm4v',
])

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'mpeg',
])

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
  'html',
  'htm',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'csv',
  'rtf',
  'epub',
])

const CATEGORY_MISMATCH_MESSAGE_KEY: Record<
  Exclude<MediaCategory, 'document'>,
  string
> = {
  image: 'URL must point to an image file',
  video: 'URL must point to a video file',
  audio: 'URL must point to an audio file',
}

export function extractUrlPathExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() || ''
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex <= 0) return ''
    return filename.slice(dotIndex + 1).toLowerCase()
  } catch {
    return ''
  }
}

function extensionMatchesCategory(
  extension: string,
  category: MediaCategory
): boolean {
  if (!extension) return false
  switch (category) {
    case 'image':
      return IMAGE_EXTENSIONS.has(extension)
    case 'video':
      return VIDEO_EXTENSIONS.has(extension)
    case 'audio':
      return AUDIO_EXTENSIONS.has(extension)
    case 'document':
      return DOCUMENT_EXTENSIONS.has(extension)
    default:
      return false
  }
}

export function validateMediaUrlForCategory(
  url: string,
  category: MediaCategory,
  mode: 'category' | 'any' = 'category'
): { ok: true } | { ok: false; messageKey: string } {
  if (mode === 'any') {
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return { ok: true }
    } catch {
      return { ok: false, messageKey: 'Please enter a valid URL' }
    }
  }

  if (category === 'document') {
    const extension = extractUrlPathExtension(url)
    if (extension && !extensionMatchesCategory(extension, category)) {
      return {
        ok: false,
        messageKey: 'URL must point to a supported document file',
      }
    }
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return { ok: true }
    } catch {
      return { ok: false, messageKey: 'Please enter a valid URL' }
    }
  }

  const extension = extractUrlPathExtension(url)
  if (!extensionMatchesCategory(extension, category)) {
    return {
      ok: false,
      messageKey:
        CATEGORY_MISMATCH_MESSAGE_KEY[
          category as Exclude<MediaCategory, 'document'>
        ],
    }
  }
  return { ok: true }
}
