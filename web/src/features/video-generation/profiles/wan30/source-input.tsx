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

import { Field, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { MediaUploader } from '../../components/media-uploader'
import type { Wan30FormValues } from './schema'

type Wan30SourceInputProps = {
  values: Wan30FormValues
  disabled?: boolean
  uploadEnabled: boolean
  maxDocumentBytes?: number
  onChange: (next: Wan30FormValues) => void
}

export function Wan30SourceInput(props: Wan30SourceInputProps) {
  const { t } = useTranslation()

  const setSourceKind = (sourceKind: Wan30FormValues['sourceKind']) => {
    props.onChange({
      ...props.values,
      sourceKind,
      referenceFile: sourceKind === 'file' ? props.values.referenceFile : [],
      referenceLinkUrl:
        sourceKind === 'link' ? props.values.referenceLinkUrl : '',
    })
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>{t('Source type')}</Label>
        <Tabs
          value={props.values.sourceKind}
          onValueChange={(value) =>
            setSourceKind(value as Wan30FormValues['sourceKind'])
          }
        >
          <TabsList className='w-full'>
            <TabsTrigger value='file' disabled={props.disabled}>
              {t('Document file')}
            </TabsTrigger>
            <TabsTrigger value='link' disabled={props.disabled}>
              {t('Web page')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <FieldDescription>
          {t(
            'Document file and web page are mutually exclusive. Thinking mode is required.'
          )}
        </FieldDescription>
      </div>

      {props.values.sourceKind === 'file' ? (
        <MediaUploader
          label={t('Reference document')}
          category='document'
          maxCount={1}
          accept='.pdf,.doc,.docx,.txt,.md,.html,.htm,.ppt,.pptx,.xls,.xlsx,application/pdf,text/*'
          maxSizeBytes={props.maxDocumentBytes}
          value={props.values.referenceFile}
          onChange={(next) =>
            props.onChange({ ...props.values, referenceFile: next })
          }
          disabled={props.disabled}
          uploadEnabled={props.uploadEnabled}
        />
      ) : (
        <Field>
          <Label htmlFor='wan30-reference-link'>{t('Web page URL')}</Label>
          <Input
            id='wan30-reference-link'
            type='url'
            inputMode='url'
            value={props.values.referenceLinkUrl}
            placeholder='https://example.com/article'
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                referenceLinkUrl: event.target.value,
              })
            }
          />
          <FieldDescription>
            {t('Public HTTP(S) URL of the page to reference')}
          </FieldDescription>
        </Field>
      )}
    </div>
  )
}
