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
import { useTranslation } from 'react-i18next'

import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { OptionSwitch } from '../../components/option-switch'
import type { ProfileFormProps } from '../types'
import {
  SEEDANCE20_DURATION_OPTIONS,
  SEEDANCE20_RATIO_OPTIONS,
  SEEDANCE20_RESOLUTION_OPTIONS,
} from './constants'
import type { Seedance20FormValues } from './schema'

export type Seedance20FormFieldsProps = ProfileFormProps<Seedance20FormValues>

export function Seedance20FormFields(props: Seedance20FormFieldsProps) {
  const { t } = useTranslation()

  const update = <K extends keyof Seedance20FormValues>(
    key: K,
    value: Seedance20FormValues[K]
  ) => {
    props.onChange({ ...props.values, [key]: value })
  }

  return (
    <div className='space-y-4'>
      <Field>
        <FieldLabel>{t('Prompt')}</FieldLabel>
        <Textarea
          value={props.values.prompt}
          disabled={props.disabled}
          rows={5}
          placeholder={t('Describe the video you want to generate')}
          onChange={(event) => update('prompt', event.target.value)}
        />
      </Field>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Field>
          <FieldLabel>{t('Video duration')}</FieldLabel>
          <Select
            value={String(props.values.duration)}
            disabled={props.disabled}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                update('duration', Number(value))
              }
            }}
          >
            <SelectTrigger className='w-full' disabled={props.disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEEDANCE20_DURATION_OPTIONS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {`${seconds}s`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{t('Resolution')}</FieldLabel>
          <Select
            value={props.values.resolution}
            disabled={props.disabled}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                update(
                  'resolution',
                  value as Seedance20FormValues['resolution']
                )
              }
            }}
          >
            <SelectTrigger className='w-full' disabled={props.disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEEDANCE20_RESOLUTION_OPTIONS.map((item) => (
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
                update('ratio', value as Seedance20FormValues['ratio'])
              }
            }}
          >
            <SelectTrigger className='w-full' disabled={props.disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEEDANCE20_RATIO_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className='flex flex-col gap-3'>
        <OptionSwitch
          id='seedance20-audio-switch'
          label={t('Generate audio')}
          description={t(
            'Include spoken audio or sound effects when supported'
          )}
          checked={props.values.audio}
          disabled={props.disabled}
          onCheckedChange={(checked) => update('audio', checked)}
        />
        <OptionSwitch
          id='seedance20-human-review-switch'
          label={t('Human review')}
          description={t('Enable when the scene involves real people')}
          checked={props.values.humanReview}
          disabled={props.disabled}
          onCheckedChange={(checked) => update('humanReview', checked)}
        />
      </div>
    </div>
  )
}
