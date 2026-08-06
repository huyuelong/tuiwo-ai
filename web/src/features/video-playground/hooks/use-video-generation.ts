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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fetchVideoTask, submitVideoGeneration } from '../api'
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  TERMINAL_TASK_STATUSES,
} from '../constants'
import {
  extractSubmitTaskId,
  getSubmitErrorMessage,
} from '../lib/build-request'
import {
  addPendingTaskId,
  removePendingTaskId,
} from '../lib/pending-tasks'
import type { AnyVideoModelProfile } from '../profiles/types'
import type { VideoSubmitRequest, VideoTaskDto } from '../types'

type UseVideoGenerationOptions = {
  onTaskUpdate?: (task: VideoTaskDto) => void
  onTerminal?: (task: VideoTaskDto) => void
  onSubmitted?: (taskId: string) => void
}

type UseVideoGenerationResult = {
  submitting: boolean
  submit: (request: VideoSubmitRequest) => Promise<void>
  resumePolling: (taskId: string, options?: { silent?: boolean }) => void
  reset: () => void
}

export function useVideoGeneration(
  options: UseVideoGenerationOptions = {}
): UseVideoGenerationResult {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const startedAtRef = useRef<Map<string, number>>(new Map())
  const optionsRef = useRef(options)
  optionsRef.current = options

  const clearPoll = useCallback((taskId?: string) => {
    if (taskId) {
      const timer = pollTimersRef.current.get(taskId)
      if (timer) {
        clearTimeout(timer)
        pollTimersRef.current.delete(taskId)
      }
      return
    }
    for (const timer of pollTimersRef.current.values()) {
      clearTimeout(timer)
    }
    pollTimersRef.current.clear()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    clearPoll()
    startedAtRef.current.clear()
    setSubmitting(false)
  }, [clearPoll])

  useEffect(() => () => reset(), [reset])

  const schedulePoll = useCallback(
    (taskId: string, silent: boolean) => {
      clearPoll(taskId)
      const timer = setTimeout(async () => {
        const startedAt = startedAtRef.current.get(taskId) || Date.now()
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          if (!silent) {
            toast.message(t('Polling timed out. Check Task Logs for progress.'))
          }
          clearPoll(taskId)
          startedAtRef.current.delete(taskId)
          removePendingTaskId(taskId)
          return
        }

        try {
          const response = await fetchVideoTask(
            taskId,
            abortRef.current?.signal
          )
          if (response.code !== 'success' || !response.data) {
            throw new Error(response.message || 'Failed to fetch video task')
          }

          const nextTask: VideoTaskDto = {
            ...response.data,
            task_id: response.data.task_id || taskId,
          }
          optionsRef.current.onTaskUpdate?.(nextTask)

          if (TERMINAL_TASK_STATUSES.has(nextTask.status)) {
            clearPoll(taskId)
            startedAtRef.current.delete(taskId)
            removePendingTaskId(taskId)
            optionsRef.current.onTerminal?.(nextTask)
            if (!silent) {
              if (nextTask.status === 'SUCCESS') {
                toast.success(t('Video generation completed'))
              } else {
                toast.error(
                  nextTask.fail_reason || t('Video generation failed')
                )
              }
            }
            return
          }

          schedulePoll(taskId, silent)
        } catch (error) {
          if ((error as { name?: string })?.name === 'CanceledError') return
          clearPoll(taskId)
          startedAtRef.current.delete(taskId)
          if (!silent) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('Failed to fetch video task')
            )
          }
        }
      }, POLL_INTERVAL_MS)
      pollTimersRef.current.set(taskId, timer)
    },
    [clearPoll, t]
  )

  const resumePolling = useCallback(
    (taskId: string, resumeOptions?: { silent?: boolean }) => {
      const id = taskId.trim()
      if (!id || pollTimersRef.current.has(id)) return
      if (!abortRef.current) {
        abortRef.current = new AbortController()
      }
      addPendingTaskId(id)
      startedAtRef.current.set(id, Date.now())
      schedulePoll(id, Boolean(resumeOptions?.silent))
    },
    [schedulePoll]
  )

  const submit = useCallback(
    async (payload: VideoSubmitRequest) => {
      if (!abortRef.current) {
        abortRef.current = new AbortController()
      }

      setSubmitting(true)

      try {
        const data = await submitVideoGeneration(
          payload,
          abortRef.current.signal
        )
        const taskId = extractSubmitTaskId(data)
        if (!taskId) {
          throw new Error(getSubmitErrorMessage(data))
        }

        addPendingTaskId(taskId)
        startedAtRef.current.set(taskId, Date.now())
        optionsRef.current.onSubmitted?.(taskId)
        toast.success(t('Video task submitted'))
        schedulePoll(taskId, false)
      } catch (error) {
        if ((error as { name?: string })?.name === 'CanceledError') return
        const message =
          (
            error as {
              response?: {
                data?: { error?: { message?: string }; message?: string }
              }
            }
          )?.response?.data?.error?.message ||
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (error instanceof Error
            ? error.message
            : t('Failed to submit video task'))
        toast.error(message)
      } finally {
        setSubmitting(false)
      }
    },
    [schedulePoll, t]
  )

  return { submitting, submit, resumePolling, reset }
}

export function validateProfileValues(
  profile: AnyVideoModelProfile,
  values: unknown
): { ok: true; values: unknown } | { ok: false; message: string } {
  const parsed = profile.schema.safeParse(values)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, message: first?.message || 'Invalid form values' }
  }
  return { ok: true, values: parsed.data }
}
