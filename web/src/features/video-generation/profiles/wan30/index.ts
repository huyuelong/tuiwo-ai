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
import { buildWan30SubmitRequest } from './build-request'
import {
  WAN30_MEDIA_SLOTS,
  WAN30_MODEL_ID,
} from './constants'
import { Wan30FormFields } from './form'
import {
  createWan30DefaultValues,
  wan30FormSchema,
  type Wan30FormValues,
} from './schema'

export const wan30Profile: VideoModelProfile<Wan30FormValues> = {
  id: 'wan30',
  displayName: 'Wan 3.0',
  matchesModel: (model) => {
    const name = model.trim().toLowerCase()
    return name === WAN30_MODEL_ID || name.startsWith('wan3.0')
  },
  supportedModes: ['text', 'frames', 'reference'],
  mediaSlots: WAN30_MEDIA_SLOTS,
  createDefaultValues: createWan30DefaultValues,
  schema: wan30FormSchema,
  buildRequest: buildWan30SubmitRequest,
  FormFields: Wan30FormFields,
}

export type { Wan30FormValues }
export {
  WAN30_MEDIA_SLOTS,
  WAN30_MODEL_ID,
  WAN30_RATIO_OPTIONS,
  WAN30_RESOLUTION_OPTIONS,
} from './constants'
export { buildWan30SubmitRequest } from './build-request'
export {
  collectTaskMediaObjectKeys,
  mapWan30FormValuesFromTask,
} from './apply-from-task'
export { createWan30DefaultValues, wan30FormSchema } from './schema'
