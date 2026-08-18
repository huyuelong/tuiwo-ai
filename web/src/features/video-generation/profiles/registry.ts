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
import type { AnyVideoModelProfile } from './types'
import { seedance20Profile } from './seedance20'
import { wan30Profile } from './wan30'

/** 已注册的视频生成 Profile。后续新模型只在此追加。 */
export const VIDEO_PROFILES: readonly AnyVideoModelProfile[] = [
  wan30Profile,
  seedance20Profile,
]

export function resolveVideoProfile(
  model: string
): AnyVideoModelProfile | null {
  const trimmed = model.trim()
  if (!trimmed) return null
  return VIDEO_PROFILES.find((profile) => profile.matchesModel(trimmed)) ?? null
}

export function isRegisteredVideoModel(model: string): boolean {
  return resolveVideoProfile(model) !== null
}

export function listRegisteredVideoModels(
  availableModels: string[]
): string[] {
  return availableModels.filter(isRegisteredVideoModel)
}
