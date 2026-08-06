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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { getVideoHistoryTasks } from '../api'
import {
  DEFAULT_VIDEO_HISTORY_PAGE_SIZE,
  VIDEO_HISTORY_PAGE_SIZES,
  type VideoHistoryPageSize,
} from '../constants'
import {
  readHistoryPageSize,
  writeHistoryPageSize,
} from '../lib/pending-tasks'
import type { VideoTaskDto } from '../types'

export const videoHistoryQueryKey = (
  page: number,
  pageSize: VideoHistoryPageSize
) => ['video-playground-history', page, pageSize] as const

type UseVideoHistoryResult = {
  page: number
  pageSize: VideoHistoryPageSize
  total: number
  totalPages: number
  items: VideoTaskDto[]
  isLoading: boolean
  isFetching: boolean
  errorMessage: string | null
  setPage: (page: number) => void
  setPageSize: (pageSize: VideoHistoryPageSize) => void
  refetch: () => Promise<unknown>
  invalidate: () => Promise<void>
  upsertTask: (task: VideoTaskDto) => void
}

export function useVideoHistory(): UseVideoHistoryResult {
  const queryClient = useQueryClient()
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState<VideoHistoryPageSize>(
    () => readHistoryPageSize() || DEFAULT_VIDEO_HISTORY_PAGE_SIZE
  )

  const query = useQuery({
    queryKey: videoHistoryQueryKey(page, pageSize),
    queryFn: ({ signal }) =>
      getVideoHistoryTasks({ p: page, page_size: pageSize, signal }),
    placeholderData: (previous) => previous,
  })

  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const items = query.data?.items ?? []

  const setPage = useCallback(
    (nextPage: number) => {
      const safe = Math.min(Math.max(1, nextPage), totalPages)
      setPageState(safe)
    },
    [totalPages]
  )

  const setPageSize = useCallback((nextSize: VideoHistoryPageSize) => {
    if (!VIDEO_HISTORY_PAGE_SIZES.includes(nextSize)) return
    writeHistoryPageSize(nextSize)
    setPageSizeState(nextSize)
    setPageState(1)
  }, [])

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['video-playground-history'],
    })
  }, [queryClient])

  const upsertTask = useCallback(
    (task: VideoTaskDto) => {
      const taskId = task.task_id?.trim()
      if (!taskId) return
      queryClient.setQueriesData(
        { queryKey: ['video-playground-history'] },
        (previous: unknown) => {
          if (!previous || typeof previous !== 'object') return previous
          const page = previous as {
            items?: VideoTaskDto[]
            total?: number
            page?: number
            page_size?: number
          }
          if (!Array.isArray(page.items)) return previous
          const index = page.items.findIndex(
            (item) => item.task_id?.trim() === taskId
          )
          if (index < 0) return previous
          const items = page.items.slice()
          items[index] = { ...items[index], ...task, task_id: taskId }
          return { ...page, items }
        }
      )
    },
    [queryClient]
  )

  const errorMessage = useMemo(() => {
    if (!query.error) return null
    return query.error instanceof Error
      ? query.error.message
      : 'Failed to load video history'
  }, [query.error])

  return {
    page,
    pageSize,
    total,
    totalPages,
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    errorMessage,
    setPage,
    setPageSize,
    refetch: query.refetch,
    invalidate,
    upsertTask,
  }
}
