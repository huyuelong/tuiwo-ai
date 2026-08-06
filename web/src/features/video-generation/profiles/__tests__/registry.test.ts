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

import {
  isRegisteredVideoModel,
  listRegisteredVideoModels,
  resolveVideoProfile,
} from '../registry'

describe('video profile registry', () => {
  test('resolves wan3.0-video to the Wan30 profile', () => {
    const profile = resolveVideoProfile('wan3.0-video')
    assert.ok(profile)
    assert.equal(profile.id, 'wan30')
  })

  test('does not fall back for unregistered models', () => {
    assert.equal(resolveVideoProfile('gpt-4o'), null)
    assert.equal(isRegisteredVideoModel('kling-v1'), false)
  })

  test('filters available models to registered profiles only', () => {
    const models = listRegisteredVideoModels([
      'gpt-4o',
      'wan3.0-video',
      'wan2.5-t2v-preview',
      'sora-2',
    ])
    assert.deepEqual(models, ['wan3.0-video'])
  })
})
