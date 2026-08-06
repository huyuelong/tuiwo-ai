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
import { api } from '@/lib/api'

import { API_ENDPOINTS, VIDEO_TASK_TYPE } from './constants'
import { isRegisteredVideoModel } from './profiles/registry'
import type {
  GroupOption,
  ModelOption,
  VideoSubmitRequest,
  VideoSubmitResponse,
  VideoTaskFetchResponse,
  VideoTaskHistoryPage,
} from './types'

export {
  completeMediaUpload,
  getMediaUploadConfig,
  initiateMediaUpload,
} from './media-api'

export async function submitVideoGeneration(
  payload: VideoSubmitRequest,
  signal?: AbortSignal
): Promise<VideoSubmitResponse> {
  const res = await api.post(API_ENDPOINTS.VIDEO_GENERATIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function fetchVideoTask(
  taskId: string,
  signal?: AbortSignal
): Promise<VideoTaskFetchResponse> {
  const res = await api.get(
    `${API_ENDPOINTS.VIDEO_GENERATIONS}/${encodeURIComponent(taskId)}`,
    {
      signal,
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
  return res.data
}

export async function getVideoHistoryTasks(params: {
  p: number
  page_size: number
  signal?: AbortSignal
}): Promise<VideoTaskHistoryPage> {
  const res = await api.get(API_ENDPOINTS.USER_TASKS, {
    params: {
      p: params.p,
      page_size: params.page_size,
      task_type: VIDEO_TASK_TYPE,
    },
    signal: params.signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)

  const payload = res.data
  if (!payload?.success || !payload.data) {
    throw new Error(payload?.message || 'Failed to load video history')
  }

  const data = payload.data as {
    items?: VideoTaskHistoryPage['items']
    total?: number
    page?: number
    page_size?: number
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === 'number' ? data.total : 0,
    page: typeof data.page === 'number' ? data.page : params.p,
    page_size:
      typeof data.page_size === 'number' ? data.page_size : params.page_size,
  }
}

export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res
  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return (data.data as string[])
    .filter(isRegisteredVideoModel)
    .map((model) => ({ label: model, value: model }))
}

export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

