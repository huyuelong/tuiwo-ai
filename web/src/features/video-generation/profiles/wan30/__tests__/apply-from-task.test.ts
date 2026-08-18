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
  collectTaskMediaObjectKeys,
  mapWan30FormValuesFromTask,
} from '../apply-from-task'
import type { VideoTaskDto } from '../../../types'

function taskWithInput(input: unknown, action = 'textGenerate'): VideoTaskDto {
  return {
    task_id: 'task_1',
    status: 'SUCCESS',
    action,
    properties: {
      input: JSON.stringify(input),
      origin_model_name: 'wan3.0-video',
    },
  }
}

describe('mapWan30FormValuesFromTask', () => {
  test('returns null when input snapshot missing', () => {
    assert.equal(
      mapWan30FormValuesFromTask({
        task_id: 'x',
        status: 'SUCCESS',
      }),
      null
    )
  })

  test('maps scalar fields and text mode', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput({
        model: 'wan3.0-video',
        prompt: '一只猫',
        duration: 8,
        metadata: {
          parameters: {
            resolution: '720P',
            ratio: '16:9',
            audio: false,
            enable_thinking: true,
          },
        },
      })
    )
    assert.ok(mapped)
    assert.equal(mapped.model, 'wan3.0-video')
    assert.equal(mapped.values.mode, 'text')
    assert.equal(mapped.values.prompt, '一只猫')
    assert.equal(mapped.values.duration, 8)
    assert.equal(mapped.values.resolution, '720P')
    assert.equal(mapped.values.ratio, '16:9')
    assert.equal(mapped.values.audio, false)
    assert.equal(mapped.values.enableThinking, true)
    assert.equal(mapped.skippedMediaCount, 0)
  })

  test('maps frames media when object_key has presigned url', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput(
        {
          model: 'wan3.0-video',
          prompt: 'frames',
          duration: 5,
          metadata: {
            parameters: { resolution: '1080P', ratio: 'adaptive' },
            input: {
              media: [
                {
                  type: 'first_frame',
                  url: 'https://expired',
                  object_key: 'media-task-assets/1/t/0.png',
                },
                {
                  type: 'last_frame',
                  url: 'https://expired2',
                  object_key: 'media-task-assets/1/t/1.png',
                },
              ],
            },
          },
        },
        'firstTailGenerate'
      ),
      {
        'media-task-assets/1/t/0.png': 'https://signed/0.png',
        'media-task-assets/1/t/1.png': 'https://signed/1.png',
      }
    )
    assert.ok(mapped)
    assert.equal(mapped.values.mode, 'frames')
    assert.equal(mapped.values.firstFrame.length, 1)
    assert.equal(mapped.values.firstFrame[0].url, 'https://signed/0.png')
    assert.equal(mapped.values.firstFrame[0].key, 'media-task-assets/1/t/0.png')
    assert.equal(mapped.values.lastFrame.length, 1)
    assert.equal(mapped.skippedMediaCount, 0)
  })

  test('restores url-only media without object_key', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput(
        {
          model: 'wan3.0-video',
          prompt: 'x',
          duration: 5,
          metadata: {
            input: {
              media: [
                {
                  type: 'first_frame',
                  url: 'https://cdn.example.com/frame.png',
                },
                {
                  type: 'reference_image',
                  url: 'https://cdn.example.com/ref.jpg',
                },
                {
                  type: 'reference_video',
                  url: 'https://cdn.example.com/ref.mp4',
                },
              ],
            },
          },
        },
        'referenceGenerate'
      ),
      {}
    )
    assert.ok(mapped)
    assert.equal(mapped.values.referenceImages.length, 1)
    assert.equal(
      mapped.values.referenceImages[0].url,
      'https://cdn.example.com/ref.jpg'
    )
    assert.equal(mapped.values.referenceVideos.length, 1)
    assert.equal(mapped.skippedMediaCount, 0)
  })

  test('skips media when object_key missing from urlMap', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput({
        model: 'wan3.0-video',
        prompt: 'x',
        duration: 5,
        metadata: {
          input: {
            media: [
              {
                type: 'reference_image',
                url: 'https://expired',
                object_key: 'media-task-assets/1/t/a.jpg',
              },
            ],
          },
        },
      }),
      {}
    )
    assert.ok(mapped)
    assert.equal(mapped.values.referenceImages.length, 0)
    assert.equal(mapped.skippedMediaCount, 1)
  })

  test('maps smart duration and seed from snapshot', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput({
        model: 'wan3.0-video',
        prompt: 'x',
        duration: -1,
        metadata: {
          parameters: {
            seed: 42,
          },
        },
      })
    )
    assert.ok(mapped)
    assert.equal(mapped.values.duration, -1)
    assert.equal(mapped.values.seed, 42)
  })

  test('falls back to defaults for out-of-range duration and unknown enums', () => {
    const mapped = mapWan30FormValuesFromTask(
      taskWithInput({
        model: 'wan3.0-video',
        prompt: 'x',
        duration: 1,
        metadata: {
          parameters: {
            resolution: '4K',
            ratio: '21:9',
            seed: -3,
          },
        },
      })
    )
    assert.ok(mapped)
    assert.equal(mapped.values.duration, 5)
    assert.equal(mapped.values.resolution, '1080P')
    assert.equal(mapped.values.ratio, 'adaptive')
    assert.equal(mapped.values.seed, undefined)
  })
})

describe('collectTaskMediaObjectKeys', () => {
  test('dedupes object keys from media list', () => {
    const keys = collectTaskMediaObjectKeys(
      taskWithInput({
        model: 'wan3.0-video',
        metadata: {
          input: {
            media: [
              {
                type: 'first_frame',
                url: 'a',
                object_key: 'media-task-assets/1/t/0.png',
              },
              {
                type: 'last_frame',
                url: 'b',
                object_key: 'media-task-assets/1/t/0.png',
              },
              { type: 'reference_image', url: 'c' },
            ],
          },
        },
      })
    )
    assert.deepEqual(keys, ['media-task-assets/1/t/0.png'])
  })
})
