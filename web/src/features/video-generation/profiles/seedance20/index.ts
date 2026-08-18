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
import type { VideoModelProfile } from '../types'
import { buildSeedance20SubmitRequest } from './build-request'
import { SEEDANCE20_MODEL_IDS } from './constants'
import { Seedance20FormFields } from './form'
import {
  createSeedance20DefaultValues,
  seedance20FormSchema,
  type Seedance20FormValues,
} from './schema'

export const seedance20Profile: VideoModelProfile<Seedance20FormValues> = {
  id: 'seedance20',
  displayName: 'Seedance 2.0',
  matchesModel: (model) => {
    const name = model.trim().toLowerCase()
    return (SEEDANCE20_MODEL_IDS as readonly string[]).includes(name)
  },
  supportedModes: ['text'],
  mediaSlots: [],
  createDefaultValues: createSeedance20DefaultValues,
  schema: seedance20FormSchema,
  buildRequest: buildSeedance20SubmitRequest,
  FormFields: Seedance20FormFields,
}

export type { Seedance20FormValues }
export {
  SEEDANCE20_DEFAULT_MODEL,
  SEEDANCE20_DURATION_OPTIONS,
  SEEDANCE20_MODEL_IDS,
  SEEDANCE20_RATIO_OPTIONS,
  SEEDANCE20_RESOLUTION_OPTIONS,
} from './constants'
export { buildSeedance20SubmitRequest } from './build-request'
export { mapSeedance20FormValuesFromTask } from './apply-from-task'
export {
  createSeedance20DefaultValues,
  seedance20FormSchema,
} from './schema'
