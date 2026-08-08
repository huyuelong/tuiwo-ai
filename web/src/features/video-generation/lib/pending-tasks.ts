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
  DEFAULT_VIDEO_HISTORY_PAGE_SIZE,
  VIDEO_HISTORY_PAGE_SIZE_KEY,
  VIDEO_HISTORY_PAGE_SIZES,
  VIDEO_PENDING_TASK_IDS_KEY,
  type VideoHistoryPageSize,
} from '../constants'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readHistoryPageSize(): VideoHistoryPageSize {
  if (!canUseStorage()) return DEFAULT_VIDEO_HISTORY_PAGE_SIZE
  const raw = window.localStorage.getItem(VIDEO_HISTORY_PAGE_SIZE_KEY)
  const value = Number(raw)
  if (
    VIDEO_HISTORY_PAGE_SIZES.includes(value as VideoHistoryPageSize)
  ) {
    return value as VideoHistoryPageSize
  }
  return DEFAULT_VIDEO_HISTORY_PAGE_SIZE
}

export function writeHistoryPageSize(pageSize: VideoHistoryPageSize): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(VIDEO_HISTORY_PAGE_SIZE_KEY, String(pageSize))
}

export function readPendingTaskIds(): string[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(VIDEO_PENDING_TASK_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function writePendingTaskIds(taskIds: string[]): void {
  if (!canUseStorage()) return
  const unique = [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))]
  window.localStorage.setItem(VIDEO_PENDING_TASK_IDS_KEY, JSON.stringify(unique))
}

export function addPendingTaskId(taskId: string): void {
  const id = taskId.trim()
  if (!id) return
  const current = readPendingTaskIds()
  if (current.includes(id)) return
  writePendingTaskIds([id, ...current])
}

export function removePendingTaskId(taskId: string): void {
  const id = taskId.trim()
  if (!id) return
  writePendingTaskIds(readPendingTaskIds().filter((item) => item !== id))
}
