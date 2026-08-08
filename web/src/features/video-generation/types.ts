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
export type VideoMode = 'text' | 'frames' | 'reference'

export type VideoMediaItem = {
  type: string
  url: string
  object_key?: string
}

export type VideoSubmitRequest = {
  model: string
  group?: string
  prompt: string
  duration?: number
  metadata?: {
    input?: {
      media?: VideoMediaItem[]
    }
    parameters?: {
      resolution?: string
      ratio?: string
      audio?: boolean
      enable_thinking?: boolean
      seed?: number
      [key: string]: unknown
    }
  }
}

export type VideoSubmitResponse = {
  id?: string
  task_id?: string
  status?: string
  error?: {
    message?: string
    code?: string | number
  }
  code?: string
  message?: string
}

export type VideoTaskProperties = {
  input?: string
  origin_model_name?: string
  upstream_model_name?: string
}

export type VideoTaskDto = {
  id?: number
  task_id: string
  platform?: string
  action?: string
  task_type?: string
  status: string
  progress?: string
  fail_reason?: string
  result_url?: string
  submit_time?: number
  start_time?: number
  finish_time?: number
  created_at?: number
  updated_at?: number
  quota?: number
  properties?: VideoTaskProperties
}

export type VideoTaskHistoryPage = {
  items: VideoTaskDto[]
  total: number
  page: number
  page_size: number
}

export type VideoTaskInputSnapshot = {
  model?: string
  prompt?: string
  duration?: number
  metadata?: {
    input?: {
      media?: VideoMediaItem[]
    }
    parameters?: {
      resolution?: string
      ratio?: string
      audio?: boolean
      enable_thinking?: boolean
      seed?: number
      [key: string]: unknown
    }
  }
}

export type VideoTaskFetchResponse = {
  code: string
  message?: string
  data?: VideoTaskDto
}

export type ModelOption = {
  label: string
  value: string
}

export type GroupOption = {
  label: string
  value: string
  ratio?: number
  desc?: string
}

export type MediaUploadConfig = {
  enabled: boolean
  max_image_mb: number
  max_audio_mb: number
  max_video_mb: number
  daily_bytes: number
  allowed_categories: string[]
  put_url_expiry_sec: number
  get_url_expiry_sec: number
}

export type MediaUploadInitiateRequest = {
  filename: string
  content_type: string
  size_bytes: number
}

export type MediaUploadInitiateResponse = {
  upload_id: string
  object_key: string
  put_url: string
  headers: Record<string, string>
  expires_at: number
  category: string
}

export type MediaUploadCompleteRequest = {
  upload_id: string
}

export type MediaUploadCompleteResponse = {
  upload_id: string
  object_key: string
  get_url: string
  content_type: string
  size_bytes: number
  category: string
  filename: string
  expires_at: number
}
