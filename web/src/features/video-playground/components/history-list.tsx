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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { VideoHistoryPageSize } from '../constants'
import type { VideoTaskDto } from '../types'
import { VideoHistoryCard } from './history-card'
import { VideoHistoryPagination } from './history-pagination'

type VideoHistoryListProps = {
  items: VideoTaskDto[]
  page: number
  pageSize: VideoHistoryPageSize
  total: number
  totalPages: number
  isLoading: boolean
  isFetching: boolean
  errorMessage: string | null
  onViewDetails: (task: VideoTaskDto) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: VideoHistoryPageSize) => void
}

export function VideoHistoryList(props: VideoHistoryListProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-medium'>{t('Recent generations')}</h3>
        {props.isFetching ? (
          <Loader2
            className='text-muted-foreground size-3.5 animate-spin'
            aria-hidden
          />
        ) : null}
      </div>

      {props.errorMessage ? (
        <p className='text-sm text-destructive'>{props.errorMessage}</p>
      ) : null}

      {props.isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='size-4 animate-spin' aria-hidden />
          {t('Loading history…')}
        </div>
      ) : null}

      {!props.isLoading && props.items.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No generation history yet.')}
        </p>
      ) : null}

      <div className='space-y-3'>
        {props.items.map((item) => (
          <VideoHistoryCard
            key={item.task_id}
            task={item}
            onViewDetails={props.onViewDetails}
          />
        ))}
      </div>

      {props.total > 0 ? (
        <VideoHistoryPagination
          page={props.page}
          pageSize={props.pageSize}
          total={props.total}
          totalPages={props.totalPages}
          onPageChange={props.onPageChange}
          onPageSizeChange={props.onPageSizeChange}
        />
      ) : null}
    </div>
  )
}
