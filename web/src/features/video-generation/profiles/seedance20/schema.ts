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
  SEEDANCE20_DURATION_OPTIONS,
  SEEDANCE20_RATIO_OPTIONS,
  SEEDANCE20_RESOLUTION_OPTIONS,
} from './constants'

export const seedance20FormSchema = z.object({
  prompt: z.string().trim().min(1, 'Please enter a prompt'),
  duration: z
    .number()
    .int()
    .refine(
      (value) =>
        (SEEDANCE20_DURATION_OPTIONS as readonly number[]).includes(value),
      { message: 'Duration must be 5 or 10 seconds' }
    ),
  resolution: z.enum(SEEDANCE20_RESOLUTION_OPTIONS),
  ratio: z.enum(SEEDANCE20_RATIO_OPTIONS),
  audio: z.boolean(),
  humanReview: z.boolean(),
})

export type Seedance20FormValues = z.infer<typeof seedance20FormSchema>

export function createSeedance20DefaultValues(): Seedance20FormValues {
  return {
    prompt: '',
    duration: 5,
    resolution: '1080p',
    ratio: '16:9',
    audio: true,
    humanReview: false,
  }
}
