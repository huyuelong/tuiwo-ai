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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildSeedance20SubmitRequest } from '../build-request'
import { createSeedance20DefaultValues } from '../schema'
import { seedance20Profile } from '../index'

describe('seedance20 buildRequest', () => {
  test('builds wan-aligned submit body and omits human_review when false', () => {
    const values = {
      ...createSeedance20DefaultValues(),
      prompt: '一位演员在咖啡馆自然地看向镜头',
      duration: 5,
      resolution: '1080p' as const,
      ratio: '16:9' as const,
      audio: true,
      humanReview: false,
    }
    const request = buildSeedance20SubmitRequest({
      model: 'seedance-2.0-fast',
      group: 'default',
      values,
    })
    assert.equal(request.model, 'seedance-2.0-fast')
    assert.equal(request.prompt, values.prompt)
    assert.equal(request.duration, 5)
    assert.deepEqual(request.metadata?.parameters, {
      resolution: '1080p',
      ratio: '16:9',
      audio: true,
    })
  })

  test('includes human_review only when enabled', () => {
    const request = buildSeedance20SubmitRequest({
      model: 'seedance-2.0',
      group: '',
      values: {
        ...createSeedance20DefaultValues(),
        prompt: 'hello',
        humanReview: true,
      },
    })
    assert.equal(request.metadata?.parameters?.human_review, true)
  })
})

describe('seedance20 profile', () => {
  test('matches seedance 2.0 model ids only', () => {
    assert.equal(seedance20Profile.matchesModel('seedance-2.0-fast'), true)
    assert.equal(seedance20Profile.matchesModel('seedance-2.0'), true)
    assert.equal(seedance20Profile.matchesModel('wan3.0-video'), false)
    assert.equal(
      seedance20Profile.matchesModel('doubao-seedance-2-0-260128'),
      false
    )
  })
})
