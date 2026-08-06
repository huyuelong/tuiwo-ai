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
import { api } from '@/lib/api'

import { API_ENDPOINTS } from './constants'
import type {
  MediaUploadCompleteRequest,
  MediaUploadCompleteResponse,
  MediaUploadConfig,
  MediaUploadInitiateRequest,
  MediaUploadInitiateResponse,
} from './types'

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  message?: string
}

export async function getMediaUploadConfig(): Promise<MediaUploadConfig> {
  const res = await api.get(API_ENDPOINTS.MEDIA_UPLOAD_CONFIG)
  const body = res.data as ApiEnvelope<MediaUploadConfig>
  if (!body.success || !body.data) {
    return {
      enabled: false,
      max_image_mb: 20,
      max_audio_mb: 100,
      max_video_mb: 500,
      daily_bytes: 0,
      allowed_categories: [],
      put_url_expiry_sec: 600,
      get_url_expiry_sec: 86400,
    }
  }
  return body.data
}

export async function initiateMediaUpload(
  payload: MediaUploadInitiateRequest
): Promise<MediaUploadInitiateResponse> {
  const res = await api.post(API_ENDPOINTS.MEDIA_UPLOAD_INITIATE, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const body = res.data as ApiEnvelope<MediaUploadInitiateResponse>
  if (!body.success || !body.data) {
    throw new Error(body.message || 'Failed to initiate media upload')
  }
  return body.data
}

export async function completeMediaUpload(
  payload: MediaUploadCompleteRequest
): Promise<MediaUploadCompleteResponse> {
  const res = await api.post(API_ENDPOINTS.MEDIA_UPLOAD_COMPLETE, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const body = res.data as ApiEnvelope<MediaUploadCompleteResponse>
  if (!body.success || !body.data) {
    throw new Error(body.message || 'Failed to complete media upload')
  }
  return body.data
}

export async function presignMediaObjectKeys(
  objectKeys: string[],
  signal?: AbortSignal
): Promise<Record<string, string>> {
  if (objectKeys.length === 0) return {}
  const res = await api.post(
    API_ENDPOINTS.MEDIA_PRESIGN_GET,
    { object_keys: objectKeys },
    { signal, skipErrorHandler: true } as Record<string, unknown>
  )
  const body = res.data as ApiEnvelope<{ urls?: Record<string, string> }>
  if (!body?.success) {
    throw new Error(body?.message || 'Failed to presign media')
  }
  return (body.data?.urls || {}) as Record<string, string>
}
