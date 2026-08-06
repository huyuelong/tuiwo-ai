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
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'

import type { VideoHistoryPageSize } from '../constants'
import type { VideoTaskDto } from '../types'
import { VideoHistoryList } from './history-list'
import { VideoTaskDetailSheet } from './task-detail-sheet'

type VideoResultPanelProps = {
  items: VideoTaskDto[]
  page: number
  pageSize: VideoHistoryPageSize
  total: number
  totalPages: number
  isLoading: boolean
  isFetching: boolean
  errorMessage: string | null
  setPage: (page: number) => void
  setPageSize: (pageSize: VideoHistoryPageSize) => void
  onViewDetails: (task: VideoTaskDto) => void
  detailTask: VideoTaskDto | null
  onDetailOpenChange: (open: boolean) => void
  runningCount?: number
}

export function VideoResultPanel(props: VideoResultPanelProps) {
  const { t } = useTranslation()
  const runningCount = props.runningCount ?? 0

  return (
    <>
      <Card
        data-card-hover='false'
        className='flex min-h-0 flex-col gap-0 border py-0 ring-0'
      >
        <div className='flex shrink-0 items-center justify-between gap-2 border-b p-3 sm:p-4'>
          <CardTitle>{t('Generation result')}</CardTitle>
          <Button
            variant='outline'
            size='sm'
            className='shrink-0'
            render={
              <Link to='/usage-logs/$section' params={{ section: 'task' }} />
            }
          >
            {t('Task Logs')}
          </Button>
        </div>

        <div className='bg-background flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4'>
          <h3 className='text-sm font-medium'>{t('Recent generations')}</h3>
          {runningCount > 0 ? (
            <span className='text-muted-foreground text-sm'>
              · {t('{{count}} running', { count: runningCount })}
            </span>
          ) : null}
          {props.isFetching ? (
            <Loader2
              className='text-muted-foreground size-3.5 animate-spin'
              aria-hidden
            />
          ) : null}
        </div>

        <div className='flex min-h-0 flex-1 flex-col'>
          <VideoHistoryList
            items={props.items}
            page={props.page}
            pageSize={props.pageSize}
            total={props.total}
            totalPages={props.totalPages}
            isLoading={props.isLoading}
            errorMessage={props.errorMessage}
            onViewDetails={props.onViewDetails}
            onPageChange={props.setPage}
            onPageSizeChange={props.setPageSize}
          />
        </div>
      </Card>

      <VideoTaskDetailSheet
        task={props.detailTask}
        open={props.detailTask != null}
        onOpenChange={props.onDetailOpenChange}
      />
    </>
  )
}
