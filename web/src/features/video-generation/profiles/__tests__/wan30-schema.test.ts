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

import { createWan30DefaultValues, wan30FormSchema } from '../wan30/schema'

describe('wan30 form schema', () => {
  test('accepts a valid text-to-video form', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      prompt: 'hello',
    })
    assert.equal(parsed.success, true)
  })

  test('rejects frames mode without any frame media', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      mode: 'frames',
      prompt: 'hello',
    })
    assert.equal(parsed.success, false)
  })

  test('rejects reference mode without media', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      mode: 'reference',
      prompt: 'hello',
    })
    assert.equal(parsed.success, false)
  })

  test('rejects source file mode without document', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      mode: 'source',
      sourceKind: 'file',
      prompt: 'hello',
    })
    assert.equal(parsed.success, false)
  })

  test('accepts source link mode with valid URL', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      mode: 'source',
      sourceKind: 'link',
      prompt: 'hello',
      referenceLinkUrl: 'https://example.com/article',
      enableThinking: true,
    })
    assert.equal(parsed.success, true)
  })

  test('rejects duration outside 2-30', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      prompt: 'hello',
      duration: 1,
    })
    assert.equal(parsed.success, false)
  })

  test('accepts smart duration -1', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      prompt: 'hello',
      duration: -1,
    })
    assert.equal(parsed.success, true)
  })

  test('accepts optional seed in range', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      prompt: 'hello',
      seed: 0,
    })
    assert.equal(parsed.success, true)
  })

  test('rejects seed out of range', () => {
    const parsed = wan30FormSchema.safeParse({
      ...createWan30DefaultValues(),
      prompt: 'hello',
      seed: -1,
    })
    assert.equal(parsed.success, false)
  })
})
