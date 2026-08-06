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
import type { MediaSlotDefinition } from '../types'

export const WAN30_MODEL_ID = 'wan3.0-video'

// 随机种子上界（含）
export const WAN30_SEED_MAX = 2147483647

export const WAN30_RESOLUTION_OPTIONS = ['480P', '720P', '1080P'] as const

export const WAN30_RATIO_OPTIONS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  'adaptive',
] as const

export const WAN30_MEDIA_SLOTS: readonly MediaSlotDefinition[] = [
  {
    id: 'firstFrame',
    labelKey: 'First frame',
    category: 'image',
    maxCount: 1,
    modes: ['frames'],
    mediaType: 'first_frame',
    accept: 'image/*',
  },
  {
    id: 'lastFrame',
    labelKey: 'Last frame',
    category: 'image',
    maxCount: 1,
    modes: ['frames'],
    mediaType: 'last_frame',
    accept: 'image/*',
  },
  {
    id: 'referenceImages',
    labelKey: 'Reference images',
    category: 'image',
    maxCount: 10,
    modes: ['reference'],
    mediaType: 'reference_image',
    accept: 'image/*',
  },
  {
    id: 'referenceVideos',
    labelKey: 'Reference videos',
    category: 'video',
    maxCount: 5,
    modes: ['reference'],
    mediaType: 'reference_video',
    accept: 'video/*',
  },
  {
    id: 'referenceAudios',
    labelKey: 'Reference audios',
    category: 'audio',
    maxCount: 5,
    modes: ['reference'],
    mediaType: 'reference_audio',
    accept: 'audio/*',
  },
] as const

