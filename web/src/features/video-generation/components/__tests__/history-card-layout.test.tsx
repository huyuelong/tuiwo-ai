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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'
import type React from 'react'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Completed: 'Completed',
        'Generating...': 'Generating...',
        Failed: 'Failed',
        Unknown: 'Unknown',
        'Text to video': 'Text to video',
        'Copy task ID': 'Copy task ID',
        'Copy prompt': 'Copy prompt',
        'No prompt snapshot': 'No prompt snapshot',
        'Video duration': 'Duration',
        Resolution: 'Resolution',
        'Aspect ratio': 'Aspect ratio',
        Model: 'Model',
        'Creation time': 'Creation time',
        'Generation time': 'Generation time',
        'View details': 'View details',
        'Apply parameters': 'Apply parameters',
        'Applying…': 'Applying…',
        'Download video': 'Download video',
        'Video URL unavailable': 'Video URL unavailable',
      },
    },
  },
})

const { VideoHistoryCard } = await import('../history-card')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const FULL_TASK_ID =
  'task_P10abcdefghijklmnopqrstuvwxyzABCDEFGHabcdefabeX'

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCard(
  props: React.ComponentProps<typeof VideoHistoryCard>
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <VideoHistoryCard {...props} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('video history card layout', () => {
  after(() => {
    domWindow.close()
  })

  test('shows the full task id without truncation', async () => {
    const rendered = await renderCard({
      task: {
        task_id: FULL_TASK_ID,
        status: 'IN_PROGRESS',
        action: 'textGenerate',
        progress: '30%',
        properties: {
          input: JSON.stringify({
            prompt: '一只猫在窗台上睡觉',
            model: 'wan3.0-video',
            duration: 5,
            metadata: {
              parameters: { resolution: '1080P', ratio: 'adaptive' },
            },
          }),
        },
        submit_time: 1_754_450_913,
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })

    assert.equal(rendered.container.textContent?.includes(FULL_TASK_ID), true)
    assert.equal(rendered.container.textContent?.includes('task_P10…abeX'), false)

    const prompt = rendered.container.querySelector('p.line-clamp-3')
    assert.ok(prompt)
    assert.equal(prompt.className.includes('min-h-[3lh]'), true)

    const labels = Array.from(
      rendered.container.querySelectorAll('.w-24.shrink-0')
    ).map((el) => el.textContent)
    assert.deepEqual(labels, [
      'Model',
      'Duration',
      'Resolution',
      'Aspect ratio',
      'Creation time',
      'Generation time',
    ])
    assert.equal(rendered.container.textContent?.includes('5s'), true)

    assert.ok(
      rendered.container.querySelector('.bg-primary\\/10.text-primary')
    )

    await unmountCard(rendered)
  })

  test('applies distinct official status tones by task state', async () => {
    const success = await renderCard({
      task: {
        task_id: 'task_success',
        status: 'SUCCESS',
        action: 'textGenerate',
        stored_result_key: 'media-results/1/a.mp4',
        properties: {
          input: JSON.stringify({ prompt: 'ok', model: 'wan3.0-video' }),
        },
      },
      mediaUrlMap: {
        'media-results/1/a.mp4': 'https://example.com/a.mp4',
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })
    assert.ok(
      success.container.querySelector('.bg-success\\/10.text-success')
    )
    await unmountCard(success)

    const failed = await renderCard({
      task: {
        task_id: 'task_failed',
        status: 'FAILURE',
        action: 'textGenerate',
        fail_reason: 'upstream error',
        properties: {
          input: JSON.stringify({ prompt: 'bad', model: 'wan3.0-video' }),
        },
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })
    assert.ok(
      failed.container.querySelector(
        '.bg-destructive\\/10.text-destructive'
      )
    )
    await unmountCard(failed)
  })

  test('centers the unavailable video message when a success task has no result key', async () => {
    const rendered = await renderCard({
      task: {
        task_id: 'task_missing_url',
        status: 'SUCCESS',
        action: 'textGenerate',
        properties: {
          input: JSON.stringify({ prompt: 'ok', model: 'wan3.0-video' }),
        },
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })

    const placeholder = rendered.container.querySelector(
      '.aspect-video.flex-col.items-center.justify-center.text-center'
    )
    assert.ok(placeholder)
    assert.equal(placeholder.textContent?.includes('Video URL unavailable'), true)

    await unmountCard(rendered)
  })

  test('plays success video from mediaUrlMap by stored_result_key', async () => {
    const key = 'media-results/1/2026/08/09/task_ok.mp4'
    const rendered = await renderCard({
      task: {
        task_id: 'task_ok',
        status: 'SUCCESS',
        action: 'textGenerate',
        stored_result_key: key,
        properties: {
          input: JSON.stringify({ prompt: 'ok', model: 'wan3.0-video' }),
        },
      },
      mediaUrlMap: { [key]: 'https://cdn.example/signed.mp4' },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })

    const video = rendered.container.querySelector('video')
    assert.ok(video)
    assert.equal(video.getAttribute('src'), 'https://cdn.example/signed.mp4')

    await unmountCard(rendered)
  })

  test('plays success video from upstream result_url when not archived', async () => {
    const rendered = await renderCard({
      task: {
        task_id: 'task_upstream',
        status: 'SUCCESS',
        action: 'textGenerate',
        result_url: 'https://upstream.example.com/video.mp4',
        properties: {
          input: JSON.stringify({ prompt: 'ok', model: 'wan3.0-video' }),
        },
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })

    const video = rendered.container.querySelector('video')
    assert.ok(video)
    assert.equal(
      video.getAttribute('src'),
      'https://upstream.example.com/video.mp4'
    )

    await unmountCard(rendered)
  })

  test('shows download video button for successful tasks', async () => {
    const rendered = await renderCard({
      task: {
        task_id: 'task_download',
        status: 'SUCCESS',
        action: 'referenceGenerate',
        stored_result_key: 'media-results/1/a.mp4',
        properties: {
          input: JSON.stringify({ prompt: 'ok', model: 'wan3.0-video' }),
        },
      },
      mediaUrlMap: {
        'media-results/1/a.mp4': 'https://example.com/a.mp4',
      },
      onViewDetails: () => undefined,
      onApplyParameters: () => undefined,
    })

    const download = Array.from(
      rendered.container.querySelectorAll('button')
    ).find((button) => button.textContent?.includes('Download video'))
    assert.ok(download)

    const actionBar = rendered.container.querySelector(
      '.mt-auto.flex.flex-wrap.items-center.justify-between'
    )
    assert.ok(actionBar)
    const leftGroup = actionBar?.firstElementChild
    assert.ok(leftGroup)
    assert.equal(leftGroup?.textContent?.includes('View details'), true)
    assert.equal(leftGroup?.textContent?.includes('Apply parameters'), true)
    assert.equal(leftGroup?.textContent?.includes('Download video'), false)
    assert.equal(actionBar?.lastElementChild, download)

    await unmountCard(rendered)
  })
})
