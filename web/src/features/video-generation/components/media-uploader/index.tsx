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
import { FileUp, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import type { MediaAsset, MediaCategory } from '../../profiles/types'
import { useMediaUpload } from './use-media-upload'

export type MediaUploaderProps = {
  label: string
  category: MediaCategory
  maxCount: number
  maxSizeBytes?: number
  accept?: string
  value: MediaAsset[]
  onChange: (next: MediaAsset[]) => void
  disabled?: boolean
  uploadEnabled: boolean
}

function formatBytes(size: number): string {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaUploader(props: MediaUploaderProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [urlOpen, setUrlOpen] = useState(!props.uploadEnabled)
  const [urlDraft, setUrlDraft] = useState('')

  const {
    pending,
    remainingSlots,
    uploadFiles,
    cancelUpload,
    retryUpload,
    removeAsset,
    addFromUrl,
  } = useMediaUpload({
    category: props.category,
    maxCount: props.maxCount,
    maxSizeBytes: props.maxSizeBytes,
    disabled: props.disabled,
    value: props.value,
    onChange: props.onChange,
  })

  const canAdd = remainingSlots > 0 && !props.disabled

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <Label htmlFor={inputId}>{props.label}</Label>
        <span className='text-xs text-muted-foreground'>
          {props.value.length}/{props.maxCount}
        </span>
      </div>

      {props.uploadEnabled ? (
        <>
          <button
            type='button'
            disabled={!canAdd}
            aria-label={t('Drag and drop files here, or click to browse')}
            className={cn(
              'flex w-full flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
              canAdd && 'hover:border-primary/60 hover:bg-muted/50',
              dragOver && 'border-primary bg-primary/5',
              !canAdd && 'cursor-not-allowed opacity-60'
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              if (canAdd) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              if (!canAdd) return
              void uploadFiles(event.dataTransfer.files)
            }}
          >
            <FileUp className='size-5 text-muted-foreground' aria-hidden />
            <p className='text-sm text-muted-foreground'>
              {t('Drag and drop files here, or click to browse')}
            </p>
          </button>
          <input
            ref={fileInputRef}
            id={inputId}
            type='file'
            className='sr-only'
            accept={props.accept}
            multiple={props.maxCount > 1}
            disabled={!canAdd}
            onChange={(event) => {
              if (event.target.files) {
                void uploadFiles(event.target.files)
                event.target.value = ''
              }
            }}
          />
        </>
      ) : (
        <p className='text-xs text-muted-foreground'>
          {t('File upload is disabled. Add media by URL instead.')}
        </p>
      )}

      {pending.length > 0 ? (
        <ul className='space-y-2'>
          {pending.map((item) => (
            <li
              key={item.localId}
              className='rounded-md border p-2 text-sm'
              aria-live='polite'
            >
              <div className='mb-1 flex items-center justify-between gap-2'>
                <span className='truncate'>{item.name}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Cancel upload')}
                  onClick={() => cancelUpload(item.localId)}
                >
                  <X className='size-4' />
                </Button>
              </div>
              {item.status === 'uploading' ? (
                <div className='flex items-center gap-2'>
                  <Loader2 className='size-3.5 animate-spin' aria-hidden />
                  <Progress value={item.progress} className='h-1.5 flex-1' />
                  <span className='text-xs text-muted-foreground'>
                    {item.progress}%
                  </span>
                </div>
              ) : (
                <div className='space-y-2'>
                  <p className='text-xs text-destructive'>
                    {item.error || t('Upload failed')}
                  </p>
                  {item.file ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => retryUpload(item.localId)}
                    >
                      <RotateCcw className='size-3.5' aria-hidden />
                      {t('Retry')}
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {props.value.length > 0 ? (
        <ul className='space-y-2'>
          {props.value.map((asset, index) => (
            <li
              key={`${asset.url}-${index}`}
              className='flex items-start gap-2 rounded-md border p-2'
            >
              <MediaPreview asset={asset} category={props.category} />
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{asset.name}</p>
                <p className='truncate text-xs text-muted-foreground'>
                  {asset.mime}
                  {asset.size ? ` · ${formatBytes(asset.size)}` : ''}
                </p>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                disabled={props.disabled}
                aria-label={t('Remove file')}
                onClick={() => removeAsset(index)}
              >
                <Trash2 className='size-4' />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Collapsible open={urlOpen} onOpenChange={setUrlOpen}>
        <CollapsibleTrigger
          render={
            <Button type='button' variant='link' size='sm' className='h-auto px-0' />
          }
        >
          {urlOpen ? t('Hide URL input') : t('Add from URL')}
        </CollapsibleTrigger>
        <CollapsibleContent className='mt-2 space-y-2'>
          <div className='flex gap-2'>
            <Input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder={t('https://example.com/media')}
              disabled={props.disabled || !canAdd}
              aria-label={t('Media URL')}
            />
            <Button
              type='button'
              variant='outline'
              disabled={props.disabled || !canAdd || !urlDraft.trim()}
              onClick={() => {
                addFromUrl(urlDraft)
                setUrlDraft('')
              }}
            >
              {t('Add')}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function MediaPreview(props: {
  asset: MediaAsset
  category: MediaCategory
}) {
  if (props.category === 'image' && props.asset.url) {
    return (
      <img
        src={props.asset.url}
        alt=''
        className='size-12 rounded object-cover'
      />
    )
  }
  if (props.category === 'video' && props.asset.url) {
    return (
      <video
        src={props.asset.url}
        className='size-12 rounded object-cover'
        muted
        playsInline
        preload='metadata'
      />
    )
  }
  return (
    <div
      className='flex size-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground'
      aria-hidden
    >
      {props.category === 'audio' ? 'AUD' : 'FILE'}
    </div>
  )
}
