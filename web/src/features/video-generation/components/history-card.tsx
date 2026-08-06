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
  formatConfiguredDuration,
  formatTaskElapsed,
  parseTaskInput,
  resolveStatusLabelKey,
  resolveStatusToneClass,
  resolveTaskModeLabelKey,
  resolveTaskModelName,
} from '../lib/parse-task-input'
import type { VideoTaskDto } from '../types'

type VideoHistoryCardProps = {
  task: VideoTaskDto
  onViewDetails: (task: VideoTaskDto) => void
  onApplyParameters: (task: VideoTaskDto) => void
  applyingParameters?: boolean
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

// 卡片参数行
function CardKvRow(props: { label: string; value: string }) {
  return (
    <div className='flex gap-3 text-xs sm:text-sm'>
      <span className='text-muted-foreground w-24 shrink-0'>{props.label}</span>
      <span className='min-w-0 flex-1 break-all'>{props.value}</span>
    </div>
  )
}

export function VideoHistoryCard(props: VideoHistoryCardProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard()

  const taskId = props.task.task_id?.trim() || ''
  const statusKey = resolveStatusLabelKey(props.task)
  const statusTone = resolveStatusToneClass(props.task)
  const modeLabel = t(resolveTaskModeLabelKey(props.task))
  const modelName = resolveTaskModelName(props.task)
  const input = parseTaskInput(props.task)
  const prompt = input?.prompt?.trim() || ''
  const params = input?.metadata?.parameters
  const durationText = formatConfiguredDuration(input?.duration)
  const resolution =
    params?.resolution?.trim() || input?.size?.trim() || '-'
  const ratio = params?.ratio?.trim() || '-'
  const videoUrl = props.task.result_url?.trim() || ''

  const status = (props.task.status || '').trim().toUpperCase()
  const isSuccess = status === 'SUCCESS'
  const isFailure = status === 'FAILURE' || status === 'FAILED'
  const isNonTerminal = !TERMINAL_TASK_STATUSES.has(status)

  return (
    <div className='border-border w-full rounded-lg border p-3 text-left'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex min-w-0 flex-col gap-2.5 text-sm'>
          <div className='flex flex-wrap items-center gap-1.5'>
            {/* 任务 ID 完整展示，使用 primary 色 */}
            <span
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                'bg-primary/10 text-primary'
              )}
            >
              <span className='font-mono break-all whitespace-normal'>
                {taskId || '-'}
              </span>
              {taskId ? (
                <button
                  type='button'
                  className='hover:bg-primary/15 shrink-0 rounded-full p-0.5'
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

          {/* 提示词固定三行高度，过长截断 */}
          <div className='flex items-start gap-2'>
            <p
              className={cn(
                'line-clamp-3 min-h-[3lh] min-w-0 flex-1 leading-normal',
                prompt
                  ? 'text-foreground/90'
                  : 'text-muted-foreground italic'
              )}
            >
              {prompt || t('No prompt snapshot')}
            </p>
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

          {/* 顺序对齐表单：模型 → 时长 → 分辨率 → 比例 → 创作/生成时间 */}
          <div className='space-y-1.5'>
            <CardKvRow label={t('Model')} value={modelName} />
            <CardKvRow label={t('Video duration')} value={durationText} />
            <CardKvRow label={t('Resolution')} value={resolution} />
            <CardKvRow label={t('Aspect ratio')} value={ratio} />
            <CardKvRow
              label={t('Creation time')}
              value={formatSubmitTime(props.task)}
            />
            <CardKvRow
              label={t('Generation time')}
              value={formatTaskElapsed(props.task)}
            />
          </div>

          <div className='mt-auto flex flex-wrap gap-2 pt-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => props.onViewDetails(props.task)}
            >
              {t('View details')}
            </Button>
            <Button
              type='button'
              variant='default'
              size='sm'
              disabled={props.applyingParameters}
              onClick={() => props.onApplyParameters(props.task)}
            >
              {props.applyingParameters ? (
                <>
                  <Loader2 className='size-3.5 animate-spin' aria-hidden />
                  {t('Applying…')}
                </>
              ) : (
                t('Apply parameters')
              )}
            </Button>
          </div>
        </div>

        <div className='flex min-w-0 flex-col justify-center space-y-2'>
          {isNonTerminal ? (
            <div className='bg-muted/40 text-muted-foreground flex aspect-video flex-col items-center justify-center gap-2 rounded-md border text-sm'>
              <Loader2 className='size-5 animate-spin' aria-hidden />
              <span>{t('Generating...')}</span>
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
