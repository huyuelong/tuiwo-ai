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
import type {
  VideoMediaItem,
  VideoTaskDto,
  VideoTaskInputSnapshot,
} from '../types'

export type TaskStatusLabelKey =
  | 'Completed'
  | 'Generating...'
  | 'Failed'
  | 'Unknown'

export type TaskMediaGroups = {
  firstFrame: VideoMediaItem[]
  lastFrame: VideoMediaItem[]
  referenceImages: VideoMediaItem[]
  referenceVideos: VideoMediaItem[]
  referenceAudios: VideoMediaItem[]
}

// 解析任务输入
export function parseTaskInput(
  task: Pick<VideoTaskDto, 'properties'>
): VideoTaskInputSnapshot | null {
  const raw = task.properties?.input
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as VideoTaskInputSnapshot
  } catch {
    return null
  }
}

// 解析任务模型名称
export function resolveTaskModelName(task: VideoTaskDto): string {
  const input = parseTaskInput(task)
  return (
    input?.model?.trim() ||
    task.properties?.origin_model_name?.trim() ||
    task.properties?.upstream_model_name?.trim() ||
    '-'
  )
}

// 解析任务模式标签
export function resolveTaskModeLabelKey(task: VideoTaskDto): string {
  const action = (task.action || '').trim()
  if (action === 'firstTailGenerate') return 'First / last frame'
  if (action === 'referenceGenerate') return 'Reference'
  if (action === 'generate') return 'Image to video'
  if (action === 'textGenerate' || !action) {
    const input = parseTaskInput(task)
    const media = input?.metadata?.input?.media || []
    if (media.some((item) => item.type === 'first_frame' || item.type === 'last_frame')) {
      return 'First / last frame'
    }
    if (media.some((item) => item.type.startsWith('reference_'))) {
      return 'Reference'
    }
    if ((input?.images?.length || 0) > 0) {
      return 'Image to video'
    }
    return 'Text to video'
  }
  return action
}

// 将时间戳转换为 Unix 秒
function toUnixSeconds(timestamp: number): number {
  return timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp
}

// 格式化时长
function formatHumanDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  if (minutes < 60) {
    return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  const parts = [`${hours}h`]
  if (remMinutes > 0) parts.push(`${remMinutes}m`)
  if (remSeconds > 0) parts.push(`${remSeconds}s`)
  return parts.join(' ')
}

// 解析任务状态标签
export function resolveStatusLabelKey(
  task: Pick<VideoTaskDto, 'status'>
): TaskStatusLabelKey {
  const status = (task.status || '').trim().toUpperCase()
  if (status === 'SUCCESS') return 'Completed'
  if (status === 'FAILURE' || status === 'FAILED') return 'Failed'
  if (status === 'UNKNOWN') return 'Unknown'
  return 'Generating...'
}

// 任务状态徽章色：对齐 usage-logs StatusBadge 语义色（success / destructive / chart-1）
export function resolveStatusToneClass(
  task: Pick<VideoTaskDto, 'status'>
): string {
  const key = resolveStatusLabelKey(task)
  if (key === 'Completed') return 'bg-success/10 text-success'
  if (key === 'Failed') return 'bg-destructive/10 text-destructive'
  if (key === 'Generating...') return 'bg-chart-1/10 text-chart-1'
  return 'bg-muted text-muted-foreground'
}

// 格式化任务耗时
export function formatTaskElapsed(task: Pick<VideoTaskDto, 'submit_time' | 'start_time' | 'finish_time'>): string {
  const finishTime = task.finish_time
  if (!finishTime) return '-'
  const startTime = task.submit_time || task.start_time
  if (!startTime) return '-'
  const elapsedSec = toUnixSeconds(finishTime) - toUnixSeconds(startTime)
  if (elapsedSec < 0) return '-'
  return formatHumanDuration(elapsedSec)
}

// 格式化配置时长
export function formatConfiguredDuration(
  duration: number | null | undefined
): string {
  if (duration == null) return '-'
  if (duration === -1) return '-1'
  if (duration <= 0) return '-'
  return formatHumanDuration(duration)
}

// 格式化尺寸行
export function formatSizeLine(task: Pick<VideoTaskDto, 'properties'>): string {
  const input = parseTaskInput(task)
  if (!input) return '-'
  const parts: string[] = []
  if (input.duration === -1) {
    parts.push('-1')
  } else if (input.duration != null && input.duration > 0) {
    parts.push(`${input.duration}s`)
  }
  const resolution =
    input.metadata?.parameters?.resolution?.trim() || input.size?.trim()
  if (resolution) parts.push(resolution)
  const ratio = input.metadata?.parameters?.ratio?.trim()
  if (ratio) parts.push(ratio)
  return parts.length > 0 ? parts.join(' · ') : '-'
}

// 截断任务 ID
export function truncateTaskId(id: string, head = 8, tail = 4): string {
  const trimmed = id.trim()
  if (!trimmed) return '-'
  if (trimmed.length <= head + tail + 1) return trimmed
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`
}

// 分组任务媒体
export function groupTaskMedia(
  task: Pick<VideoTaskDto, 'properties'>
): TaskMediaGroups {
  const input = parseTaskInput(task)
  const media = input?.metadata?.input?.media || []
  const groups: TaskMediaGroups = {
    firstFrame: [],
    lastFrame: [],
    referenceImages: [],
    referenceVideos: [],
    referenceAudios: [],
  }
  for (const item of media) {
    switch (item.type) {
      case 'first_frame':
        groups.firstFrame.push(item)
        break
      case 'last_frame':
        groups.lastFrame.push(item)
        break
      case 'reference_image':
        groups.referenceImages.push(item)
        break
      case 'reference_video':
        groups.referenceVideos.push(item)
        break
      case 'reference_audio':
        groups.referenceAudios.push(item)
        break
    }
  }
  return groups
}
