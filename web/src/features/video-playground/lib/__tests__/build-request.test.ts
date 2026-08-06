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

import { buildWan30SubmitRequest } from '../../profiles/wan30/build-request'
import {
  WAN30_MEDIA_SLOTS,
  WAN30_RATIO_OPTIONS,
} from '../../profiles/wan30/constants'
import { createWan30DefaultValues } from '../../profiles/wan30/schema'

describe('buildWan30SubmitRequest', () => {
  test('builds a text-to-video payload with parameters', () => {
    const payload = buildWan30SubmitRequest({
      model: 'wan3.0-video',
      group: 'default',
      values: {
        ...createWan30DefaultValues(),
        prompt: 'a cat walking on the moon',
        duration: 8,
        resolution: '720P',
        ratio: '9:16',
        audio: false,
        enableThinking: true,
      },
    })

    assert.deepEqual(payload, {
      model: 'wan3.0-video',
      group: 'default',
      prompt: 'a cat walking on the moon',
      duration: 8,
      size: '720P',
      metadata: {
        parameters: {
          resolution: '720P',
          ratio: '9:16',
          audio: false,
          enable_thinking: true,
        },
      },
    })
  })

  test('maps first/last frame assets into typed media URLs only', () => {
    const payload = buildWan30SubmitRequest({
      model: 'wan3.0-video',
      group: 'default',
      values: {
        ...createWan30DefaultValues(),
        mode: 'frames',
        prompt: 'morph',
        firstFrame: [
          {
            uploadId: 'u1',
            key: 'media/1.jpg',
            url: 'https://example.com/first.jpg',
            name: 'first.jpg',
            mime: 'image/jpeg',
            size: 12,
          },
        ],
        lastFrame: [
          {
            url: 'https://example.com/last.jpg',
            name: 'last.jpg',
            mime: 'image/jpeg',
            size: 0,
          },
        ],
      },
    })

    assert.deepEqual(payload.metadata?.input?.media, [
      {
        type: 'first_frame',
        url: 'https://example.com/first.jpg',
        object_key: 'media/1.jpg',
      },
      { type: 'last_frame', url: 'https://example.com/last.jpg' },
    ])
    assert.equal(payload.images, undefined)
  })

  test('keeps a last-frame-only asset typed as last_frame', () => {
    const payload = buildWan30SubmitRequest({
      model: 'wan3.0-video',
      group: 'default',
      values: {
        ...createWan30DefaultValues(),
        mode: 'frames',
        prompt: 'morph',
        lastFrame: [
          {
            url: 'https://example.com/last.jpg',
            name: 'last.jpg',
            mime: 'image/jpeg',
            size: 0,
          },
        ],
      },
    })

    assert.deepEqual(payload.metadata?.input?.media, [
      { type: 'last_frame', url: 'https://example.com/last.jpg' },
    ])
  })

  test('maps reference assets into metadata.input.media with slot limits', () => {
    const payload = buildWan30SubmitRequest({
      model: 'wan3.0-video',
      group: 'default',
      values: {
        ...createWan30DefaultValues(),
        mode: 'reference',
        prompt: 'style match',
        referenceImages: [
          {
            url: 'https://a.com/1.jpg',
            name: '1.jpg',
            mime: 'image/jpeg',
            size: 1,
          },
          {
            url: 'https://a.com/2.jpg',
            name: '2.jpg',
            mime: 'image/jpeg',
            size: 1,
          },
        ],
        referenceVideos: [
          {
            url: 'https://a.com/v.mp4',
            name: 'v.mp4',
            mime: 'video/mp4',
            size: 1,
          },
        ],
      },
    })

    assert.deepEqual(payload.metadata?.input?.media, [
      { type: 'reference_image', url: 'https://a.com/1.jpg' },
      { type: 'reference_image', url: 'https://a.com/2.jpg' },
      { type: 'reference_video', url: 'https://a.com/v.mp4' },
    ])
  })

  test('uses the backend default ratio and exposes only supported ratios', () => {
    assert.equal(createWan30DefaultValues().ratio, 'adaptive')
    assert.equal(WAN30_RATIO_OPTIONS.includes('21:9' as never), false)
  })

  test('defines Wan3 media slot capacity limits', () => {
    const byId = Object.fromEntries(
      WAN30_MEDIA_SLOTS.map((slot) => [slot.id, slot.maxCount])
    )
    assert.deepEqual(byId, {
      firstFrame: 1,
      lastFrame: 1,
      referenceImages: 10,
      referenceVideos: 5,
      referenceAudios: 5,
    })
  })
})
