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
import type { ComponentType } from 'react'
import type { z } from 'zod'

import type { VideoMode, VideoSubmitRequest } from '../types'

export type MediaCategory = 'image' | 'video' | 'audio'

/** 表单中的上传或 URL 媒体；上游请求只发送 `url`。 */
export type MediaAsset = {
  uploadId?: string
  key?: string
  url: string
  name: string
  mime: string
  size: number
}

export type MediaSlotDefinition = {
  id: string
  /** 槽位标签的 i18n 键 */
  labelKey: string
  category: MediaCategory
  maxCount: number
  /** 该槽位可见的模式 */
  modes: VideoMode[]
  /** 上游 media.type，如 first_frame、reference_image */
  mediaType: string
  accept?: string
}

export type ProfileFormProps<TValues> = {
  values: TValues
  onChange: (next: TValues) => void
  disabled?: boolean
  uploadEnabled: boolean
  /** 上传 API 可用时提供，用于前端大小限制提示 */
  uploadConfig?: {
    max_image_mb: number
    max_audio_mb: number
    max_video_mb: number
  } | null
}

export type VideoModelProfile<TValues = unknown> = {
  id: string
  displayName: string
  matchesModel: (model: string) => boolean
  supportedModes: readonly VideoMode[]
  mediaSlots: readonly MediaSlotDefinition[]
  createDefaultValues: () => TValues
  schema: z.ZodType<TValues>
  buildRequest: (args: {
    model: string
    group: string
    values: TValues
  }) => VideoSubmitRequest
  FormFields: ComponentType<ProfileFormProps<TValues>>
}

export type AnyVideoModelProfile = VideoModelProfile<any>
