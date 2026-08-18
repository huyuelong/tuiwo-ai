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
import { parseTaskInput } from '../../lib/parse-task-input'
import type { VideoTaskDto } from '../../types'
import {
  SEEDANCE20_DURATION_OPTIONS,
  SEEDANCE20_RATIO_OPTIONS,
  SEEDANCE20_RESOLUTION_OPTIONS,
} from './constants'
import {
  createSeedance20DefaultValues,
  type Seedance20FormValues,
} from './schema'

export type Seedance20ApplyResult = {
  model: string
  values: Seedance20FormValues
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pickEnum<T extends string>(
  value: string,
  options: readonly T[],
  fallback: T
): T {
  return (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/** 从任务 Input 快照映射 Seedance 表单（仅标量，无媒体）。 */
export function mapSeedance20FormValuesFromTask(
  task: VideoTaskDto
): Seedance20ApplyResult | null {
  const snapshot = parseTaskInput(task)
  if (!snapshot) return null

  const model = (
    snapshot.model ||
    task.properties?.origin_model_name ||
    task.properties?.upstream_model_name ||
    ''
  ).trim()
  if (!model.toLowerCase().startsWith('seedance-2.0')) {
    return null
  }

  const defaults = createSeedance20DefaultValues()
  const params = snapshot.metadata?.parameters || {}
  const duration =
    typeof snapshot.duration === 'number' &&
    (SEEDANCE20_DURATION_OPTIONS as readonly number[]).includes(
      snapshot.duration
    )
      ? snapshot.duration
      : defaults.duration

  const values: Seedance20FormValues = {
    prompt: asString(snapshot.prompt) || defaults.prompt,
    duration,
    resolution: pickEnum(
      asString(params.resolution).toLowerCase(),
      SEEDANCE20_RESOLUTION_OPTIONS,
      defaults.resolution
    ),
    ratio: pickEnum(
      asString(params.ratio),
      SEEDANCE20_RATIO_OPTIONS,
      defaults.ratio
    ),
    audio: typeof params.audio === 'boolean' ? params.audio : defaults.audio,
    humanReview:
      typeof params.human_review === 'boolean'
        ? params.human_review
        : defaults.humanReview,
  }

  return { model, values }
}
