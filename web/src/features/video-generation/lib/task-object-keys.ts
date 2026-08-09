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
import { collectTaskMediaObjectKeys } from '../profiles/wan30/apply-from-task'
import type { VideoTaskDto } from '../types'

/** 收集任务参考媒体 + 结果视频的 object_key，供统一预签名。 */
export function collectTaskObjectKeys(task: VideoTaskDto): string[] {
  const keys = collectTaskMediaObjectKeys(task)
  const resultKey = task.stored_result_key?.trim()
  if (!resultKey || keys.includes(resultKey)) {
    return keys
  }
  return [...keys, resultKey]
}

/** 汇总多条任务的 object_key（去重，保序）。 */
export function collectTasksObjectKeys(tasks: VideoTaskDto[]): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const task of tasks) {
    for (const key of collectTaskObjectKeys(task)) {
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

/** 列表播放仅收集结果视频 key，避免与参考素材合计超过批量预签名上限。 */
export function collectTasksResultObjectKeys(tasks: VideoTaskDto[]): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const task of tasks) {
    const key = task.stored_result_key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}
