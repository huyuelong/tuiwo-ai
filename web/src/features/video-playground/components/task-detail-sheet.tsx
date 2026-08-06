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
import { Check, Copy, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import {
  formatSizeLine,
  formatTaskElapsed,
  groupTaskMedia,
  parseTaskInput,
  resolveStatusLabelKey,
  resolveTaskModeLabelKey,
  resolveTaskModelName,
  type TaskMediaGroups,
} from '../lib/parse-task-input'
import { presignMediaObjectKeys } from '../media-api'
import type { VideoMediaItem, VideoTaskDto } from '../types'

type VideoTaskDetailSheetProps = {
  task: VideoTaskDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MediaGroupSection = {
  key: keyof TaskMediaGroups
  labelKey: string
  kind: 'image' | 'video' | 'audio'
}

const MEDIA_GROUP_SECTIONS: MediaGroupSection[] = [
  { key: 'firstFrame', labelKey: 'First frame', kind: 'image' },
  { key: 'lastFrame', labelKey: 'Last frame', kind: 'image' },
  { key: 'referenceImages', labelKey: 'Reference images', kind: 'image' },
  { key: 'referenceVideos', labelKey: 'Reference videos', kind: 'video' },
  { key: 'referenceAudios', labelKey: 'Reference audios', kind: 'audio' },
]

function formatSubmitTime(task: VideoTaskDto): string {
  const seconds = task.submit_time || task.created_at
  if (!seconds) return '-'
  const ms = seconds > 1e12 ? seconds : seconds * 1000
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return '-'
  }
}

function formatOptionalBoolean(
  value: boolean | undefined,
  t: (key: string) => string
): string {
  if (value === undefined) return '-'
  return value ? t('Yes') : t('No')
}

function collectObjectKeys(groups: TaskMediaGroups): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const section of MEDIA_GROUP_SECTIONS) {
    for (const item of groups[section.key]) {
      const key = item.object_key?.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

function resolveMediaDisplayUrl(
  item: VideoMediaItem,
  urlMap: Record<string, string>
): string {
  const objectKey = item.object_key?.trim()
  if (objectKey) {
    const signed = urlMap[objectKey]?.trim()
    if (signed) return signed
  }
  return item.url?.trim() || ''
}

function DetailKvRow(props: { label: string; value: string }) {
  return (
    <div className='flex gap-3 text-sm'>
      <span className='text-muted-foreground w-28 shrink-0'>{props.label}</span>
      <span className='min-w-0 flex-1 break-all'>{props.value}</span>
    </div>
  )
}

function MediaPreview(props: {
  kind: 'image' | 'video' | 'audio'
  url: string
  unavailableLabel: string
}) {
  if (!props.url) {
    return (
      <p className='text-muted-foreground text-sm'>{props.unavailableLabel}</p>
    )
  }
  if (props.kind === 'image') {
    return (
      <img
        src={props.url}
        alt=''
        className='max-h-48 w-full rounded-md border object-contain bg-muted/30'
      />
    )
  }
  if (props.kind === 'video') {
    return (
      <video
        className='aspect-video w-full rounded-md border bg-black'
        src={props.url}
        controls
        playsInline
        preload='metadata'
      />
    )
  }
  return (
    <audio className='w-full' src={props.url} controls preload='metadata' />
  )
}

export function VideoTaskDetailSheet(props: VideoTaskDetailSheetProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard()
  const [urlMap, setUrlMap] = useState<Record<string, string>>({})
  const [presigning, setPresigning] = useState(false)
  const [presignError, setPresignError] = useState<string | null>(null)

  const task = props.task
  const taskId = task?.task_id?.trim() || ''

  useEffect(() => {
    if (!props.open || !task) {
      setUrlMap({})
      setPresignError(null)
      setPresigning(false)
      return
    }

    const groups = groupTaskMedia(task)
    const objectKeys = collectObjectKeys(groups)
    if (objectKeys.length === 0) {
      setUrlMap({})
      setPresignError(null)
      setPresigning(false)
      return
    }

    const controller = new AbortController()
    setPresigning(true)
    setPresignError(null)

    void presignMediaObjectKeys(objectKeys, controller.signal)
      .then((urls) => {
        if (controller.signal.aborted) return
        setUrlMap(urls)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : t('Failed to presign media')
        setPresignError(message)
        toast.error(t('Failed to presign media'))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPresigning(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [props.open, task, t])

  const statusKey = task ? resolveStatusLabelKey(task) : 'Unknown'
  let statusTone = 'bg-muted text-muted-foreground'
  if (statusKey === 'Completed') {
    statusTone = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  } else if (statusKey === 'Failed') {
    statusTone = 'bg-destructive/10 text-destructive'
  } else if (statusKey === 'Generating…') {
    statusTone = 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  }

  const input = task ? parseTaskInput(task) : null
  const prompt = input?.prompt?.trim() || ''
  const params = input?.metadata?.parameters
  const modelName = task ? resolveTaskModelName(task) : '-'
  const modeLabel = task ? t(resolveTaskModeLabelKey(task)) : '-'
  const groups = task ? groupTaskMedia(task) : null
  const resultUrl = task?.result_url?.trim() || ''
  const durationText =
    input?.duration != null && input.duration > 0
      ? `${input.duration}s`
      : '-'
  const resolution =
    params?.resolution?.trim() || input?.size?.trim() || '-'
  const ratio = params?.ratio?.trim() || '-'

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'
      >
        <SheetHeader className='border-b p-4 text-start sm:p-5'>
          <SheetTitle>{t('Task details')}</SheetTitle>
          <SheetDescription>
            {taskId
              ? `${t('Task ID')}: ${taskId}`
              : t('View full task parameters and media')}
          </SheetDescription>
        </SheetHeader>

        {task ? (
          <div className='min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5'>
            <div className='flex flex-wrap items-center gap-1.5'>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  statusTone
                )}
              >
                {t(statusKey)}
              </span>
              <span className='bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'>
                {modeLabel}
              </span>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-medium'>{t('Task ID')}</h3>
                {taskId ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    className='text-muted-foreground shrink-0'
                    aria-label={t('Copy task ID')}
                    onClick={() => void copyToClipboard(taskId)}
                  >
                    {copiedText === taskId ? (
                      <Check className='size-3.5 text-emerald-600' aria-hidden />
                    ) : (
                      <Copy className='size-3.5' aria-hidden />
                    )}
                  </Button>
                ) : null}
              </div>
              <p className='font-mono text-sm break-all'>{taskId || '-'}</p>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-medium'>{t('Prompt')}</h3>
                {prompt ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    className='text-muted-foreground shrink-0'
                    aria-label={t('Copy prompt')}
                    onClick={() => void copyToClipboard(prompt)}
                  >
                    {copiedText === prompt ? (
                      <Check className='size-3.5 text-emerald-600' aria-hidden />
                    ) : (
                      <Copy className='size-3.5' aria-hidden />
                    )}
                  </Button>
                ) : null}
              </div>
              {prompt ? (
                <p className='text-foreground/90 whitespace-pre-wrap text-sm'>
                  {prompt}
                </p>
              ) : (
                <p className='text-muted-foreground text-sm italic'>
                  {t('No prompt snapshot')}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>{t('Parameters')}</h3>
              <div className='space-y-1.5'>
                <DetailKvRow label={t('Model')} value={modelName} />
                <DetailKvRow label={t('Duration')} value={durationText} />
                <DetailKvRow label={t('Resolution')} value={resolution} />
                <DetailKvRow label={t('Ratio')} value={ratio} />
                <DetailKvRow
                  label={t('Audio')}
                  value={formatOptionalBoolean(params?.audio, t)}
                />
                <DetailKvRow
                  label={t('Enable thinking')}
                  value={formatOptionalBoolean(params?.enable_thinking, t)}
                />
                <DetailKvRow
                  label={t('Duration/size')}
                  value={formatSizeLine(task)}
                />
                <DetailKvRow
                  label={t('Generation time')}
                  value={formatTaskElapsed(task)}
                />
                <DetailKvRow
                  label={t('Creation time')}
                  value={formatSubmitTime(task)}
                />
              </div>
            </div>

            {groups ? (
              <div className='space-y-4'>
                <div className='flex items-center justify-between gap-2'>
                  <h3 className='text-sm font-medium'>{t('Reference media')}</h3>
                  {presigning ? (
                    <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
                      <Loader2 className='size-3.5 animate-spin' aria-hidden />
                      {t('Loading media…')}
                    </span>
                  ) : null}
                </div>
                {presignError ? (
                  <p className='text-destructive text-sm'>{presignError}</p>
                ) : null}
                {MEDIA_GROUP_SECTIONS.map((section) => {
                  const items = groups[section.key]
                  if (items.length === 0) return null
                  return (
                    <div key={section.key} className='space-y-2'>
                      <h4 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                        {t(section.labelKey)}
                      </h4>
                      <div className='space-y-3'>
                        {items.map((item, index) => {
                          const url = resolveMediaDisplayUrl(item, urlMap)
                          return (
                            <MediaPreview
                              key={`${section.key}-${item.object_key || item.url || index}`}
                              kind={section.kind}
                              url={url}
                              unavailableLabel={t('Media unavailable')}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {resultUrl ? (
              <div className='space-y-2'>
                <h3 className='text-sm font-medium'>{t('Result video')}</h3>
                <video
                  className='aspect-video w-full rounded-md border bg-black'
                  src={resultUrl}
                  controls
                  playsInline
                  preload='metadata'
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
