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
  formatConfiguredDuration,
  formatSizeLine,
  formatTaskElapsed,
  groupTaskMedia,
  parseTaskInput,
  resolveStatusLabelKey,
  resolveStatusToneClass,
  resolveTaskModeLabelKey,
  resolveTaskMediaItemUrl,
  resolveTaskModelName,
  truncateTaskId,
} from '../parse-task-input'
import type { VideoTaskDto } from '../../types'

describe('parseTaskInput', () => {
  test('parses properties.input JSON snapshot', () => {
    const task: VideoTaskDto = {
      task_id: 'task_1',
      status: 'SUCCESS',
      properties: {
        input: JSON.stringify({
          model: 'wan3.0-video',
          prompt: 'a cat',
          duration: 5,
          metadata: {
            parameters: { resolution: '720P', ratio: '16:9' },
          },
        }),
      },
    }

    assert.deepEqual(parseTaskInput(task), {
      model: 'wan3.0-video',
      prompt: 'a cat',
      duration: 5,
      metadata: {
        parameters: { resolution: '720P', ratio: '16:9' },
      },
    })
    assert.equal(resolveTaskModelName(task), 'wan3.0-video')
  })

  test('returns null for missing or invalid input', () => {
    assert.equal(parseTaskInput({ properties: undefined }), null)
    assert.equal(
      parseTaskInput({
        properties: { input: '{not-json' },
      }),
      null
    )
  })

  test('infers mode from action and media metadata', () => {
    assert.equal(
      resolveTaskModeLabelKey({
        task_id: 'a',
        status: 'SUCCESS',
        action: 'firstTailGenerate',
      }),
      'First / last frame'
    )

    assert.equal(
      resolveTaskModeLabelKey({
        task_id: 'b',
        status: 'SUCCESS',
        action: 'textGenerate',
        properties: {
          input: JSON.stringify({
            metadata: {
              input: {
                media: [{ type: 'reference_image', url: 'https://x' }],
              },
            },
          }),
        },
      }),
      'Reference'
    )

    assert.equal(
      resolveTaskModeLabelKey({
        task_id: 'c',
        status: 'SUCCESS',
        action: 'textGenerate',
      }),
      'Text to video'
    )
  })
})

describe('resolveStatusLabelKey', () => {
  test('maps SUCCESS to Completed', () => {
    assert.equal(
      resolveStatusLabelKey({ status: 'SUCCESS' }),
      'Completed'
    )
  })
})

describe('resolveStatusToneClass', () => {
  test('uses official success tone for SUCCESS', () => {
    assert.equal(
      resolveStatusToneClass({ status: 'SUCCESS' }),
      'bg-success/10 text-success'
    )
  })

  test('uses official destructive tone for FAILURE', () => {
    assert.equal(
      resolveStatusToneClass({ status: 'FAILURE' }),
      'bg-destructive/10 text-destructive'
    )
  })

  test('uses official blue tone for IN_PROGRESS', () => {
    assert.equal(
      resolveStatusToneClass({ status: 'IN_PROGRESS' }),
      'bg-chart-1/10 text-chart-1'
    )
  })

  test('uses muted tone for UNKNOWN', () => {
    assert.equal(
      resolveStatusToneClass({ status: 'UNKNOWN' }),
      'bg-muted text-muted-foreground'
    )
  })
})

describe('formatTaskElapsed', () => {
  test('returns dash when unfinished', () => {
    assert.equal(formatTaskElapsed({ submit_time: 100 }), '-')
  })

  test('formats elapsed seconds between submit and finish', () => {
    assert.equal(
      formatTaskElapsed({
        submit_time: 100,
        finish_time: 145,
      }),
      '45s'
    )
  })
})

describe('formatConfiguredDuration', () => {
  test('formats positive seconds like generation elapsed', () => {
    assert.equal(formatConfiguredDuration(5), '5s')
  })

  test('returns dash for missing or non-positive duration', () => {
    assert.equal(formatConfiguredDuration(undefined), '-')
    assert.equal(formatConfiguredDuration(0), '-')
  })

  test('keeps smart duration sentinel as -1', () => {
    assert.equal(formatConfiguredDuration(-1), '-1')
  })
})

describe('formatSizeLine', () => {
  test('joins duration resolution and ratio', () => {
    assert.equal(
      formatSizeLine({
        properties: {
          input: JSON.stringify({
            duration: 5,
            metadata: {
              parameters: { resolution: '720P', ratio: '16:9' },
            },
          }),
        },
      }),
      '5s · 720P · 16:9'
    )
  })
})

describe('truncateTaskId', () => {
  test('shortens long ids with head and tail', () => {
    assert.equal(truncateTaskId('task_abcdefghijklmnop', 4, 4), 'task…mnop')
  })
})

describe('groupTaskMedia', () => {
  test('buckets by type', () => {
    const groups = groupTaskMedia({
      properties: {
        input: JSON.stringify({
          metadata: {
            input: {
              media: [
                {
                  type: 'first_frame',
                  url: 'https://a',
                  object_key: 'media-task-assets/1/t/0.png',
                },
                {
                  type: 'reference_audio',
                  url: 'https://b',
                  object_key: 'media-task-assets/1/t/1.mp3',
                },
              ],
            },
          },
        }),
      },
    })
    assert.equal(groups.firstFrame.length, 1)
    assert.equal(groups.referenceAudios.length, 1)
  })
})

describe('resolveTaskMediaItemUrl', () => {
  test('uses presigned url for uploaded media with object_key', () => {
    assert.equal(
      resolveTaskMediaItemUrl(
        {
          type: 'first_frame',
          url: 'https://expired',
          object_key: 'media-task-assets/1/t/0.png',
        },
        { 'media-task-assets/1/t/0.png': 'https://signed/0.png' }
      ),
      'https://signed/0.png'
    )
  })

  test('returns empty for object_key media when presign missing', () => {
    assert.equal(
      resolveTaskMediaItemUrl({
        type: 'first_frame',
        url: 'https://expired',
        object_key: 'media-task-assets/1/t/0.png',
      }),
      ''
    )
  })

  test('uses snapshot url for url-only media', () => {
    assert.equal(
      resolveTaskMediaItemUrl({
        type: 'reference_image',
        url: 'https://cdn.example.com/ref.jpg',
      }),
      'https://cdn.example.com/ref.jpg'
    )
  })
})
