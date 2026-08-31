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
import { describe, expect, it } from 'vitest'

import type { PricingModel } from '../../types'
import {
  buildVideoTaskExamplePrices,
  calculateVideoTaskPriceUSD,
  getVideoTaskBaseUnitPriceUSD,
  getVideoTaskPricingProfile,
  isVideoTaskPricingModel,
} from '../video-task-pricing'

function wanVideoModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'wan3.0-video',
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 0,
    model_price: 0.00572,
    enable_groups: ['default'],
    ...overrides,
  }
}

describe('video-task-pricing', () => {
  it('detects wan3.0 video models', () => {
    expect(isVideoTaskPricingModel(wanVideoModel())).toBe(true)
    expect(isVideoTaskPricingModel(wanVideoModel({ model_name: 'gpt-4o' }))).toBe(
      false
    )
  })

  it('calculates duration and resolution multipliers from base unit price', () => {
    const model = wanVideoModel()
    const profile = getVideoTaskPricingProfile(model.model_name)
    expect(profile).not.toBeNull()
    expect(getVideoTaskBaseUnitPriceUSD(model)).toBe(0.00572)

    expect(
      calculateVideoTaskPriceUSD({
        baseUnitPriceUSD: 0.00572,
        durationSeconds: 5,
        resolutionMultiplier: 4,
        groupRatio: 1,
      })
    ).toBeCloseTo(0.1144)

    const examples = buildVideoTaskExamplePrices({
      model,
      profile: profile!,
      durations: [5],
      resolutions: ['1080P'],
    })
    expect(examples).toHaveLength(1)
    expect(examples[0]?.priceUSD).toBeCloseTo(0.1144)
  })
})
