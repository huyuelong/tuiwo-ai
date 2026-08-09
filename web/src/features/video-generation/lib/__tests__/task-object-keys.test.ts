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

import type { VideoTaskDto } from '../../types'
import {
  collectTaskObjectKeys,
  collectTasksObjectKeys,
  collectTasksResultObjectKeys,
} from '../task-object-keys'

function task(partial: Partial<VideoTaskDto> & { task_id: string }): VideoTaskDto {
  return {
    status: 'SUCCESS',
    ...partial,
  }
}

describe('collectTaskObjectKeys', () => {
  test('includes media keys and stored result key', () => {
    const keys = collectTaskObjectKeys(
      task({
        task_id: 't1',
        stored_result_key: 'media-results/1/2026/08/09/t1.mp4',
        properties: {
          input: JSON.stringify({
            metadata: {
              input: {
                media: [
                  {
                    type: 'first_frame',
                    url: 'x',
                    object_key: 'media-task-assets/1/t1/0.png',
                  },
                ],
              },
            },
          }),
        },
      })
    )
    assert.deepEqual(keys, [
      'media-task-assets/1/t1/0.png',
      'media-results/1/2026/08/09/t1.mp4',
    ])
  })

  test('returns only result key when task has no reference media', () => {
    const keys = collectTaskObjectKeys(
      task({
        task_id: 't2',
        stored_result_key: 'media-results/1/a.mp4',
      })
    )
    assert.deepEqual(keys, ['media-results/1/a.mp4'])
  })
})

describe('collectTasksObjectKeys', () => {
  test('dedupes keys across tasks', () => {
    const shared = 'media-task-assets/1/shared.png'
    const keys = collectTasksObjectKeys([
      task({
        task_id: 'a',
        stored_result_key: 'media-results/1/a.mp4',
        properties: {
          input: JSON.stringify({
            metadata: {
              input: { media: [{ type: 'first_frame', url: 'x', object_key: shared }] },
            },
          }),
        },
      }),
      task({
        task_id: 'b',
        stored_result_key: 'media-results/1/b.mp4',
        properties: {
          input: JSON.stringify({
            metadata: {
              input: { media: [{ type: 'first_frame', url: 'y', object_key: shared }] },
            },
          }),
        },
      }),
    ])
    assert.deepEqual(keys, [
      shared,
      'media-results/1/a.mp4',
      'media-results/1/b.mp4',
    ])
  })
})

describe('collectTasksResultObjectKeys', () => {
  test('only collects stored result keys for list playback', () => {
    const keys = collectTasksResultObjectKeys([
      task({
        task_id: 'a',
        stored_result_key: 'media-results/1/a.mp4',
        properties: {
          input: JSON.stringify({
            metadata: {
              input: {
                media: [
                  {
                    type: 'first_frame',
                    url: 'x',
                    object_key: 'media-task-assets/1/a/0.png',
                  },
                ],
              },
            },
          }),
        },
      }),
      task({
        task_id: 'b',
        stored_result_key: 'media-results/1/b.mp4',
      }),
      task({ task_id: 'c' }),
    ])
    assert.deepEqual(keys, [
      'media-results/1/a.mp4',
      'media-results/1/b.mp4',
    ])
  })
})
