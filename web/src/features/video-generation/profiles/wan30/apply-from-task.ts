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
import {
  parseTaskInput,
  resolveTaskModeLabelKey,
  resolveTaskModelName,
} from '../../lib/parse-task-input'
import type { MediaAsset } from '../types'
import type { VideoMediaItem, VideoMode, VideoTaskDto } from '../../types'
import {
  WAN30_RATIO_OPTIONS,
  WAN30_RESOLUTION_OPTIONS,
} from './constants'
import { createWan30DefaultValues, type Wan30FormValues } from './schema'

export type MapWan30FromTaskResult = {
  model: string
  values: Wan30FormValues
  /** 无 object_key 或预签名失败而跳过的媒体条数 */
  skippedMediaCount: number
}

type Resolution = (typeof WAN30_RESOLUTION_OPTIONS)[number]
type Ratio = (typeof WAN30_RATIO_OPTIONS)[number]

function isResolution(value: string): value is Resolution {
  return (WAN30_RESOLUTION_OPTIONS as readonly string[]).includes(value)
}

function isRatio(value: string): value is Ratio {
  return (WAN30_RATIO_OPTIONS as readonly string[]).includes(value)
}

function resolveMode(task: VideoTaskDto): VideoMode {
  const label = resolveTaskModeLabelKey(task)
  if (label === 'First / last frame' || label === 'Image to video') {
    return 'frames'
  }
  if (label === 'Reference') return 'reference'
  return 'text'
}

function basenameFromKey(objectKey: string): string {
  const parts = objectKey.split('/')
  return parts[parts.length - 1] || objectKey
}

function guessMime(objectKey: string, mediaType: string): string {
  const lower = objectKey.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (mediaType.includes('video')) return 'video/mp4'
  if (mediaType.includes('audio')) return 'audio/mpeg'
  return 'application/octet-stream'
}

/**
 * 仅接受带 object_key 且 urlMap 有预签名的项；无 key 的过期 URL 直接跳过。
 */
function mediaItemToAsset(
  item: VideoMediaItem,
  urlMap: Record<string, string>
): MediaAsset | null {
  const objectKey = item.object_key?.trim()
  if (!objectKey) return null
  const url = urlMap[objectKey]?.trim()
  if (!url) return null
  return {
    key: objectKey,
    url,
    name: basenameFromKey(objectKey),
    mime: guessMime(objectKey, item.type),
    size: 0,
  }
}

function mapMediaSlot(
  media: VideoMediaItem[],
  type: string,
  limit: number,
  urlMap: Record<string, string>
): { assets: MediaAsset[]; skipped: number } {
  const matched = media.filter((item) => item.type === type)
  let skipped = 0
  const assets: MediaAsset[] = []
  for (const item of matched) {
    if (assets.length >= limit) {
      skipped += 1
      continue
    }
    const asset = mediaItemToAsset(item, urlMap)
    if (!asset) {
      skipped += 1
      continue
    }
    assets.push(asset)
  }
  return { assets, skipped }
}

/** 从任务 Input 快照映射 Wan30 表单；urlMap 为 object_key → 预签名 GET。 */
export function mapWan30FormValuesFromTask(
  task: VideoTaskDto,
  urlMap: Record<string, string> = {}
): MapWan30FromTaskResult | null {
  const snapshot = parseTaskInput(task)
  if (!snapshot) return null

  const model = resolveTaskModelName(task)
  if (!model || model === '-') return null

  const defaults = createWan30DefaultValues()
  const params = snapshot.metadata?.parameters
  const media = snapshot.metadata?.input?.media || []

  let duration = defaults.duration
  if (typeof snapshot.duration === 'number' && Number.isFinite(snapshot.duration)) {
    if (snapshot.duration === -1) {
      duration = -1
    } else if (snapshot.duration >= 2 && snapshot.duration <= 30) {
      duration = Math.floor(snapshot.duration)
    }
  }

  let seed: number | undefined
  if (
    typeof params?.seed === 'number' &&
    Number.isFinite(params.seed) &&
    params.seed >= 0 &&
    params.seed <= 2147483647
  ) {
    seed = Math.floor(params.seed)
  }

  const resolutionRaw =
    params?.resolution?.trim() || snapshot.size?.trim() || ''
  const resolution = isResolution(resolutionRaw)
    ? resolutionRaw
    : defaults.resolution

  const ratioRaw = params?.ratio?.trim() || ''
  const ratio = isRatio(ratioRaw) ? ratioRaw : defaults.ratio

  const first = mapMediaSlot(media, 'first_frame', 1, urlMap)
  const last = mapMediaSlot(media, 'last_frame', 1, urlMap)
  const refImages = mapMediaSlot(media, 'reference_image', 10, urlMap)
  const refVideos = mapMediaSlot(media, 'reference_video', 5, urlMap)
  const refAudios = mapMediaSlot(media, 'reference_audio', 5, urlMap)

  // 旧版 images[] 无 object_key，无法可靠回填，计为跳过
  const legacyImageSkip = (snapshot.images || []).length

  const skippedMediaCount =
    first.skipped +
    last.skipped +
    refImages.skipped +
    refVideos.skipped +
    refAudios.skipped +
    legacyImageSkip

  const values: Wan30FormValues = {
    mode: resolveMode(task),
    prompt: snapshot.prompt?.trim() || '',
    duration,
    resolution,
    ratio,
    audio: typeof params?.audio === 'boolean' ? params.audio : defaults.audio,
    enableThinking:
      typeof params?.enable_thinking === 'boolean'
        ? params.enable_thinking
        : defaults.enableThinking,
    seed,
    firstFrame: first.assets,
    lastFrame: last.assets,
    referenceImages: refImages.assets,
    referenceVideos: refVideos.assets,
    referenceAudios: refAudios.assets,
  }

  return { model, values, skippedMediaCount }
}

/** 收集快照中全部 object_key，供批量预签名。 */
export function collectTaskMediaObjectKeys(task: VideoTaskDto): string[] {
  const snapshot = parseTaskInput(task)
  const media = snapshot?.metadata?.input?.media || []
  const keys: string[] = []
  const seen = new Set<string>()
  for (const item of media) {
    const key = item.object_key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}
