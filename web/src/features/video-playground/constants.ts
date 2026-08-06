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
export const API_ENDPOINTS = {
  VIDEO_GENERATIONS: '/pg/video/generations',
  USER_TASKS: '/api/task/self',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
  MEDIA_UPLOAD_CONFIG: '/api/user/media/upload-config',
  MEDIA_UPLOAD_INITIATE: '/api/user/media/uploads/initiate',
  MEDIA_UPLOAD_COMPLETE: '/api/user/media/uploads/complete',
  MEDIA_PRESIGN_GET: '/api/user/media/presign-get',
} as const

export const DEFAULT_GROUP = 'default' as const

export const POLL_INTERVAL_MS = 4000
export const POLL_TIMEOUT_MS = 15 * 60 * 1000

export const VIDEO_HISTORY_PAGE_SIZES = [6, 12, 24] as const
export type VideoHistoryPageSize = (typeof VIDEO_HISTORY_PAGE_SIZES)[number]
export const DEFAULT_VIDEO_HISTORY_PAGE_SIZE: VideoHistoryPageSize = 6

export const VIDEO_HISTORY_PAGE_SIZE_KEY = 'video-playground-page-size'
export const VIDEO_PENDING_TASK_IDS_KEY = 'video-playground-pending-tasks'

export const VIDEO_TASK_TYPE = 'video' as const

export const TERMINAL_TASK_STATUSES = new Set([
  'SUCCESS',
  'FAILURE',
  'FAILED',
  'UNKNOWN',
])
