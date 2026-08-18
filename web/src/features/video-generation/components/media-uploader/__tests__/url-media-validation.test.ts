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
  extractUrlPathExtension,
  validateMediaUrlForCategory,
} from '../url-media-validation'

describe('extractUrlPathExtension', () => {
  test('reads extension from pathname and ignores query string', () => {
    assert.equal(
      extractUrlPathExtension('https://cdn.example.com/a/b/photo.JPG?token=1'),
      'jpg'
    )
  })

  test('returns empty when pathname has no extension', () => {
    assert.equal(extractUrlPathExtension('https://cdn.example.com/media/123'), '')
  })
})

describe('validateMediaUrlForCategory', () => {
  test('accepts image urls for image slots', () => {
    assert.deepEqual(
      validateMediaUrlForCategory('https://cdn.example.com/ref.png', 'image'),
      { ok: true }
    )
  })

  test('rejects video urls for image slots', () => {
    const result = validateMediaUrlForCategory(
      'https://cdn.example.com/ref.mp4',
      'image'
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.messageKey, 'URL must point to an image file')
    }
  })

  test('rejects image urls for video slots', () => {
    const result = validateMediaUrlForCategory(
      'https://cdn.example.com/clip.jpg',
      'video'
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.messageKey, 'URL must point to a video file')
    }
  })

  test('accepts audio urls for audio slots', () => {
    assert.deepEqual(
      validateMediaUrlForCategory('https://cdn.example.com/voice.wav', 'audio'),
      { ok: true }
    )
  })

  test('rejects urls without a recognizable media extension', () => {
    const result = validateMediaUrlForCategory(
      'https://cdn.example.com/no-extension',
      'audio'
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.messageKey, 'URL must point to an audio file')
    }
  })
})
