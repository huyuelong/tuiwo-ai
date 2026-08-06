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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import { TERMINAL_TASK_STATUSES } from '../constants'
import {
  formatSizeLine,
  formatTaskElapsed,
  parseTaskInput,
  resolveStatusLabelKey,
  resolveTaskModeLabelKey,
  resolveTaskModelName,
  truncateTaskId,
} from '../lib/parse-task-input'
import type { VideoTaskDto } from '../types'

type VideoHistoryCardProps = {
  task: VideoTaskDto
  onViewDetails: (task: VideoTaskDto) => void
}

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

export function VideoHistoryCard(props: VideoHistoryCardProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard()

  const taskId = props.task.task_id?.trim() || ''
  const statusKey = resolveStatusLabelKey(props.task)
  const modeLabel = t(resolveTaskModeLabelKey(props.task))
  const modelName = resolveTaskModelName(props.task)
  const input = parseTaskInput(props.task)
  const prompt = input?.prompt?.trim() || ''
  const sizeLine = formatSizeLine(props.task)
  const videoUrl = props.task.result_url?.trim() || ''

  const status = (props.task.status || '').trim().toUpperCase()
  const isSuccess = status === 'SUCCESS'
  const isFailure = status === 'FAILURE' || status === 'FAILED'
  const isNonTerminal = !TERMINAL_TASK_STATUSES.has(status)

  let statusTone =
    'bg-muted text-muted-foreground'
  if (statusKey === 'Completed') {
    statusTone = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  } else if (statusKey === 'Failed') {
    statusTone = 'bg-destructive/10 text-destructive'
  } else if (statusKey === 'Generating…') {
    statusTone = 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  }

  return (
    <div className='border-border w-full rounded-lg border p-3 text-left'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex min-w-0 flex-col gap-2.5 text-sm'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <span
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              )}
            >
              <span className='truncate font-mono'>
                {truncateTaskId(taskId)}
              </span>
              {taskId ? (
                <button
                  type='button'
                  className='hover:bg-blue-500/15 shrink-0 rounded-full p-0.5'
                  aria-label={t('Copy task ID')}
                  onClick={() => void copyToClipboard(taskId)}
                >
                  {copiedText === taskId ? (
                    <Check className='size-3' aria-hidden />
                  ) : (
                    <Copy className='size-3' aria-hidden />
                  )}
                </button>
              ) : null}
            </span>
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

          <div className='flex items-start gap-2'>
            {prompt ? (
              <p className='text-foreground/90 line-clamp-3 min-w-0 flex-1'>
                {prompt}
              </p>
            ) : (
              <p className='text-muted-foreground min-w-0 flex-1 italic'>
                {t('No prompt snapshot')}
              </p>
            )}
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

          <div className='space-y-1 text-xs leading-relaxed sm:text-sm'>
            <div className='flex gap-2'>
              <span className='text-muted-foreground shrink-0'>
                {t('Model')}
              </span>
              <span className='min-w-0 break-all'>{modelName}</span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground shrink-0'>
                {t('Creation time')}
              </span>
              <span className='min-w-0'>{formatSubmitTime(props.task)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground shrink-0'>
                {t('Generation time')}
              </span>
              <span className='min-w-0'>{formatTaskElapsed(props.task)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground shrink-0'>
                {t('Duration/size')}
              </span>
              <span className='min-w-0'>{sizeLine}</span>
            </div>
          </div>

          <div className='mt-auto pt-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => props.onViewDetails(props.task)}
            >
              {t('View details')}
            </Button>
          </div>
        </div>

        <div className='flex min-w-0 flex-col justify-center space-y-2'>
          {isNonTerminal ? (
            <div className='bg-muted/40 text-muted-foreground flex aspect-video flex-col items-center justify-center gap-2 rounded-md border text-sm'>
              <Loader2 className='size-5 animate-spin' aria-hidden />
              <span>{t('Generating…')}</span>
              {props.task.progress ? (
                <span className='font-medium'>{props.task.progress}</span>
              ) : null}
            </div>
          ) : null}

          {isFailure ? (
            <p className='line-clamp-6 text-sm text-destructive'>
              {props.task.fail_reason?.trim() || t('Failed')}
            </p>
          ) : null}

          {isSuccess && videoUrl ? (
            <video
              className='aspect-video w-full rounded-md border bg-black'
              src={videoUrl}
              controls
              playsInline
              preload='metadata'
            />
          ) : null}

          {isSuccess && !videoUrl ? (
            <p className='text-muted-foreground text-sm'>
              {t('Video URL unavailable')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
