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
import { getFreshAuthHeaders } from '@/lib/api'

function buildVideoContentUrl(taskId: string): string {
  const id = taskId.trim()
  if (!id) return ''
  return `/v1/videos/${encodeURIComponent(id)}/content`
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]+/g, '_')
  return trimmed || 'video.mp4'
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8Match?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(utf8Match[1]))
    } catch {
      return sanitizeFilename(utf8Match[1])
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header)
  if (plainMatch?.[1]) {
    return sanitizeFilename(plainMatch[1])
  }
  return null
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    return response.statusText || 'Download failed'
  }
  try {
    const body = (await response.json()) as {
      error?: { message?: string }
      message?: string
    }
    return body.error?.message || body.message || 'Download failed'
  } catch {
    return 'Download failed'
  }
}

/** 带登录态拉取视频二进制并触发浏览器保存。 */
export async function downloadVideoContent(taskId: string): Promise<void> {
  const url = buildVideoContentUrl(taskId)
  if (!url) {
    throw new Error('Invalid task id')
  }

  const headers = await getFreshAuthHeaders()
  delete headers['Content-Type']

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const blob = await response.blob()
  const filename =
    filenameFromContentDisposition(
      response.headers.get('Content-Disposition')
    ) || `${sanitizeFilename(taskId)}.mp4`

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
