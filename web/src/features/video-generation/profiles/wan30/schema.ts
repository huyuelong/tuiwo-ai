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
import { z } from 'zod'

import {
  WAN30_RATIO_OPTIONS,
  WAN30_RESOLUTION_OPTIONS,
} from './constants'

const mediaAssetSchema = z.object({
  uploadId: z.string().optional(),
  key: z.string().optional(),
  url: z.string().url(),
  name: z.string(),
  mime: z.string(),
  size: z.number().nonnegative(),
})

export const wan30FormSchema = z
  .object({
    mode: z.enum(['text', 'frames', 'reference', 'source']),
    prompt: z.string().trim().min(1, 'Please enter a prompt'),
    // -1：智能时长；其它为 2–30 秒
    duration: z
      .number()
      .int()
      .refine((value) => value === -1 || (value >= 2 && value <= 30), {
        message: 'Duration must be -1 or between 2 and 30',
      }),
    resolution: z.enum(WAN30_RESOLUTION_OPTIONS),
    ratio: z.enum(WAN30_RATIO_OPTIONS),
    audio: z.boolean(),
    enableThinking: z.boolean(),
    /** 未填表示不传 seed */
    seed: z.number().int().min(0).max(2147483647).optional(),
    firstFrame: z.array(mediaAssetSchema).max(1),
    lastFrame: z.array(mediaAssetSchema).max(1),
    referenceImages: z.array(mediaAssetSchema).max(10),
    referenceVideos: z.array(mediaAssetSchema).max(5),
    referenceAudios: z.array(mediaAssetSchema).max(5),
    sourceKind: z.enum(['file', 'link']),
    referenceFile: z.array(mediaAssetSchema).max(1),
    referenceLinkUrl: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'frames') {
      if (values.firstFrame.length === 0 && values.lastFrame.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Provide at least a first or last frame',
          path: ['firstFrame'],
        })
      }
    }
    if (values.mode === 'reference') {
      const total =
        values.referenceImages.length +
        values.referenceVideos.length +
        values.referenceAudios.length
      if (total === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Provide at least one reference media item',
          path: ['referenceImages'],
        })
      }
    }
    if (values.mode === 'source') {
      if (values.sourceKind === 'file') {
        if (values.referenceFile.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Provide a document file or URL',
            path: ['referenceFile'],
          })
        }
      } else {
        const link = values.referenceLinkUrl.trim()
        if (!link) {
          ctx.addIssue({
            code: 'custom',
            message: 'Provide a web page URL',
            path: ['referenceLinkUrl'],
          })
          return
        }
        try {
          // eslint-disable-next-line no-new
          new URL(link)
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'Please enter a valid URL',
            path: ['referenceLinkUrl'],
          })
        }
      }
    }
  })

export type Wan30FormValues = z.infer<typeof wan30FormSchema>

export function createWan30DefaultValues(): Wan30FormValues {
  return {
    mode: 'text',
    prompt: '',
    duration: 5,
    resolution: '1080P',
    ratio: 'adaptive',
    audio: true,
    enableThinking: false,
    seed: undefined,
    firstFrame: [],
    lastFrame: [],
    referenceImages: [],
    referenceVideos: [],
    referenceAudios: [],
    sourceKind: 'file',
    referenceFile: [],
    referenceLinkUrl: '',
  }
}
