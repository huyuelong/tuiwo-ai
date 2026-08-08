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
import type { MediaAsset } from '../types'
import type { VideoMediaItem, VideoSubmitRequest } from '../../types'
import type { Wan30FormValues } from './schema'

function assetsToMedia(
  assets: MediaAsset[],
  type: string,
  limit: number
): VideoMediaItem[] {
  return assets.slice(0, limit).map((asset) => ({
    type,
    url: asset.url,
    ...(asset.key ? { object_key: asset.key } : {}),
  }))
}

/** 组装 Wan 3.0 的 /pg/video/generations 请求体。 */
export function buildWan30SubmitRequest(args: {
  model: string
  group: string
  values: Wan30FormValues
}): VideoSubmitRequest {
  const { model, group, values } = args
  const request: VideoSubmitRequest = {
    model,
    group: group || undefined,
    prompt: values.prompt.trim(),
    duration: values.duration,
    metadata: {
      parameters: {
        resolution: values.resolution,
        ratio: values.ratio,
        audio: values.audio,
        enable_thinking: values.enableThinking,
        ...(values.seed !== undefined ? { seed: values.seed } : {}),
      },
    },
  }

  if (values.mode === 'frames') {
    const media: VideoMediaItem[] = [
      ...assetsToMedia(values.firstFrame, 'first_frame', 1),
      ...assetsToMedia(values.lastFrame, 'last_frame', 1),
    ]
    if (media.length > 0) {
      request.metadata = {
        ...request.metadata,
        input: { media },
      }
    }
    return request
  }

  if (values.mode === 'reference') {
    const media: VideoMediaItem[] = [
      ...assetsToMedia(values.referenceImages, 'reference_image', 10),
      ...assetsToMedia(values.referenceVideos, 'reference_video', 5),
      ...assetsToMedia(values.referenceAudios, 'reference_audio', 5),
    ]
    if (media.length > 0) {
      request.metadata = {
        ...request.metadata,
        input: { media },
      }
    }
  }

  return request
}
