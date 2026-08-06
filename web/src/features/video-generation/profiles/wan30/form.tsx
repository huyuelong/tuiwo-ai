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
import { Dices } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import { MediaUploader } from '../../components/media-uploader'
import type { MediaAsset, ProfileFormProps } from '../types'
import {
  WAN30_MEDIA_SLOTS,
  WAN30_RATIO_OPTIONS,
  WAN30_RESOLUTION_OPTIONS,
  WAN30_SEED_MAX,
} from './constants'
import type { Wan30FormValues } from './schema'

export type Wan30FormFieldsProps = ProfileFormProps<Wan30FormValues>

function maxBytesForCategory(
  category: string,
  config: Wan30FormFieldsProps['uploadConfig']
): number | undefined {
  if (!config) return undefined
  if (category === 'image') return config.max_image_mb * 1024 * 1024
  if (category === 'audio') return config.max_audio_mb * 1024 * 1024
  if (category === 'video') return config.max_video_mb * 1024 * 1024
  return undefined
}

function slotAssets(
  values: Wan30FormValues,
  slotId: string
): MediaAsset[] {
  switch (slotId) {
    case 'firstFrame':
      return values.firstFrame
    case 'lastFrame':
      return values.lastFrame
    case 'referenceImages':
      return values.referenceImages
    case 'referenceVideos':
      return values.referenceVideos
    case 'referenceAudios':
      return values.referenceAudios
    default:
      return []
  }
}

function setSlotAssets(
  values: Wan30FormValues,
  slotId: string,
  next: MediaAsset[]
): Wan30FormValues {
  switch (slotId) {
    case 'firstFrame':
      return { ...values, firstFrame: next }
    case 'lastFrame':
      return { ...values, lastFrame: next }
    case 'referenceImages':
      return { ...values, referenceImages: next }
    case 'referenceVideos':
      return { ...values, referenceVideos: next }
    case 'referenceAudios':
      return { ...values, referenceAudios: next }
    default:
      return values
  }
}

export function Wan30FormFields(props: Wan30FormFieldsProps) {
  const { t } = useTranslation()

  const update = <K extends keyof Wan30FormValues>(
    key: K,
    value: Wan30FormValues[K]
  ) => {
    props.onChange({ ...props.values, [key]: value })
  }

  const visibleSlots = WAN30_MEDIA_SLOTS.filter((slot) =>
    slot.modes.includes(props.values.mode)
  )

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>{t('Mode')}</Label>
        <Tabs
          value={props.values.mode}
          onValueChange={(value) =>
            update('mode', value as Wan30FormValues['mode'])
          }
        >
          <TabsList className='w-full'>
            <TabsTrigger value='text' disabled={props.disabled}>
              {t('Text to video')}
            </TabsTrigger>
            <TabsTrigger value='frames' disabled={props.disabled}>
              {t('First / last frame')}
            </TabsTrigger>
            <TabsTrigger value='reference' disabled={props.disabled}>
              {t('Reference')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='video-prompt'>{t('Prompt')}</Label>
        <Textarea
          id='video-prompt'
          value={props.values.prompt}
          onChange={(event) => update('prompt', event.target.value)}
          placeholder={t('Describe the video you want to generate')}
          rows={4}
          disabled={props.disabled}
        />
      </div>

      {visibleSlots.length > 0 ? (
        <div className='space-y-4'>
          {visibleSlots.map((slot) => (
            <MediaUploader
              key={slot.id}
              label={t(slot.labelKey)}
              category={slot.category}
              maxCount={slot.maxCount}
              accept={slot.accept}
              maxSizeBytes={maxBytesForCategory(
                slot.category,
                props.uploadConfig
              )}
              value={slotAssets(props.values, slot.id)}
              onChange={(next) =>
                props.onChange(setSlotAssets(props.values, slot.id, next))
              }
              disabled={props.disabled}
              uploadEnabled={props.uploadEnabled}
            />
          ))}
        </div>
      ) : null}

      <div className='grid gap-3 sm:grid-cols-3'>
        <Field>
          <FieldLabel htmlFor='duration'>{t('Video duration')}</FieldLabel>
          <Input
            id='duration'
            type='number'
            min={-1}
            max={30}
            value={props.values.duration}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '' || raw === '-') return
              update('duration', Number(raw))
            }}
            disabled={props.disabled}
          />
          <FieldDescription>
            {t(
              'Duration range: 2 ~ 30 seconds. Use -1 for adaptive duration based on the prompt.'
            )}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>{t('Resolution')}</FieldLabel>
          <Select
            value={props.values.resolution}
            disabled={props.disabled}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                update('resolution', value as Wan30FormValues['resolution'])
              }
            }}
          >
            <SelectTrigger className='w-full' disabled={props.disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {WAN30_RESOLUTION_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t('Aspect ratio')}</FieldLabel>
          <Select
            value={props.values.ratio}
            disabled={props.disabled}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                update('ratio', value as Wan30FormValues['ratio'])
              }
            }}
          >
            <SelectTrigger className='w-full' disabled={props.disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {WAN30_RATIO_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor='video-seed'>{t('Seed')}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id='video-seed'
            type='number'
            min={0}
            max={WAN30_SEED_MAX}
            value={props.values.seed ?? ''}
            placeholder={t('Optional')}
            onChange={(event) => {
              const raw = event.target.value.trim()
              if (raw === '') {
                update('seed', undefined)
                return
              }
              update('seed', Number(raw))
            }}
            disabled={props.disabled}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupButton
              type='button'
              size='icon-xs'
              variant='ghost'
              disabled={props.disabled}
              aria-label={t('Randomize seed')}
              title={t('Randomize seed')}
              onClick={() => {
                update(
                  'seed',
                  Math.floor(Math.random() * (WAN30_SEED_MAX + 1))
                )
              }}
            >
              <Dices className='size-3.5' aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>
          {t('Range: 0~2147483647. Leave empty to omit.')}
        </FieldDescription>
      </Field>

      <div className='flex flex-wrap gap-6'>
        <div className='flex items-center gap-2'>
          <Switch
            checked={props.values.audio}
            onCheckedChange={(checked) => update('audio', checked)}
            disabled={props.disabled}
            id='audio-switch'
          />
          <Label htmlFor='audio-switch'>{t('Audio')}</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            checked={props.values.enableThinking}
            onCheckedChange={(checked) => update('enableThinking', checked)}
            disabled={props.disabled}
            id='thinking-switch'
          />
          <Label htmlFor='thinking-switch'>{t('Enable thinking')}</Label>
        </div>
      </div>
    </div>
  )
}
