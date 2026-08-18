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
import type { VideoSubmitRequest } from '../../types'
import type { Seedance20FormValues } from './schema'

/** 组装 Seedance 的 /pg/video/generations 请求体（与 Wan3 结构对齐）。 */
export function buildSeedance20SubmitRequest(args: {
  model: string
  group: string
  values: Seedance20FormValues
}): VideoSubmitRequest {
  const { model, group, values } = args
  return {
    model,
    group: group || undefined,
    prompt: values.prompt.trim(),
    duration: values.duration,
    metadata: {
      parameters: {
        resolution: values.resolution,
        ratio: values.ratio,
        audio: values.audio,
        ...(values.humanReview ? { human_review: true } : {}),
      },
    },
  }
}
