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
import { useQuery } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { getMediaUploadConfig, getUserGroups, getUserModels } from './api'
import { VideoResultPanel } from './components/result-panel'
import { DEFAULT_GROUP, TERMINAL_TASK_STATUSES } from './constants'
import {
  useVideoGeneration,
  validateProfileValues,
} from './hooks/use-video-generation'
import { useVideoHistory } from './hooks/use-video-history'
import { readPendingTaskIds } from './lib/pending-tasks'
import { resolveVideoProfile } from './profiles/registry'
import { createWan30DefaultValues } from './profiles/wan30/schema'
import type { VideoTaskDto } from './types'

export function VideoPlayground() {
  const { t } = useTranslation()
  const [model, setModel] = useState('wan3.0-video')
  const [group, setGroup] = useState<string>(DEFAULT_GROUP)
  const [profileValues, setProfileValues] = useState<unknown>(
    createWan30DefaultValues()
  )
  const [detailTask, setDetailTask] = useState<VideoTaskDto | null>(null)
  const resumedRef = useRef(false)

  const history = useVideoHistory()

  const { submitting, submit, resumePolling } = useVideoGeneration({
    onSubmitted: () => {
      void history.invalidate()
    },
    onTerminal: () => {
      void history.invalidate()
    },
    onTaskUpdate: (next) => {
      if (TERMINAL_TASK_STATUSES.has(next.status)) {
        void history.invalidate()
      }
    },
  })

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['video-playground-groups'],
    queryFn: getUserGroups,
  })

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['video-playground-models', group],
    queryFn: () => getUserModels(group),
    enabled: group !== '',
  })

  const { data: uploadConfig } = useQuery({
    queryKey: ['video-playground-media-upload-config'],
    queryFn: getMediaUploadConfig,
  })

  const profile = useMemo(() => resolveVideoProfile(model), [model])

  const runningCount = useMemo(() => {
    const ids = new Set<string>()
    for (const item of history.items) {
      if (!TERMINAL_TASK_STATUSES.has(item.status)) {
        const id = item.task_id?.trim()
        if (id) ids.add(id)
      }
    }
    for (const id of readPendingTaskIds()) {
      ids.add(id)
    }
    return ids.size
  }, [history.items, submitting])

  useEffect(() => {
    if (groups.length === 0) return
    if (!groups.some((item) => item.value === group)) {
      setGroup(groups[0].value)
    }
  }, [groups, group])

  useEffect(() => {
    if (models.length === 0) return
    if (!models.some((item) => item.value === model)) {
      setModel(models[0].value)
    }
  }, [models, model])

  useEffect(() => {
    if (!profile) return
    setProfileValues(profile.createDefaultValues())
  }, [profile?.id])

  useEffect(() => {
    if (resumedRef.current || history.isLoading) return
    resumedRef.current = true

    const fromHistory = history.items
      .filter((item) => !TERMINAL_TASK_STATUSES.has(item.status))
      .map((item) => item.task_id)
    const pendingIds = [...new Set([...readPendingTaskIds(), ...fromHistory])]

    for (const taskId of pendingIds) {
      resumePolling(taskId, { silent: true })
    }
  }, [history.isLoading, history.items, resumePolling])

  const uploadEnabled = Boolean(uploadConfig?.enabled)
  const FormFields = profile?.FormFields

  const handleResetParams = () => {
    if (!profile) return
    setProfileValues(profile.createDefaultValues())
    toast.success(t('Parameters reset'))
  }

  const handleSubmit = () => {
    if (!model.trim()) {
      toast.error(t('Please select a model'))
      return
    }
    if (!profile) {
      toast.error(
        t('This model is not supported in the video playground yet.')
      )
      return
    }
    const validated = validateProfileValues(profile, profileValues)
    if (!validated.ok) {
      toast.error(t(validated.message))
      return
    }
    const payload = profile.buildRequest({
      model,
      group,
      values: validated.values,
    })
    void submit(payload)
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col p-3 sm:p-4'>
      <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:grid lg:grid-cols-2 lg:overflow-hidden'>
        <Card
          data-card-hover='false'
          className='flex min-h-0 flex-col gap-0 border py-0 ring-0'
        >
          <div className='flex shrink-0 items-center justify-between gap-2 border-b p-3 sm:p-4'>
            <CardTitle>{t('Parameter settings')}</CardTitle>
            <Button
              variant='outline'
              size='sm'
              className='shrink-0'
              disabled={!profile}
              onClick={handleResetParams}
            >
              <RotateCcw className='size-4' aria-hidden />
              {t('Reset')}
            </Button>
          </div>

          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-5'>
            <div>
              <Label className='mb-2'>{t('Model')}</Label>
              <ModelGroupSelector
                className='w-full max-w-none'
                selectedModel={model}
                models={models}
                onModelChange={setModel}
                selectedGroup={group}
                groups={groups}
                onGroupChange={setGroup}
                disabled={submitting || groupsLoading || modelsLoading}
              />
            </div>

            {!profile ? (
              <p className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                {t('This model is not supported in the video playground yet.')}
              </p>
            ) : FormFields ? (
              <FormFields
                values={profileValues as never}
                onChange={setProfileValues}
                disabled={submitting}
                uploadEnabled={uploadEnabled}
                uploadConfig={uploadConfig}
              />
            ) : null}
          </div>

          <div className='bg-background shrink-0 border-t p-3 sm:p-4'>
            <Button
              className='w-full'
              disabled={submitting || !profile}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {t('Generating…')}
                </>
              ) : (
                t('Generate video')
              )}
            </Button>
          </div>
        </Card>

        <VideoResultPanel
          items={history.items}
          page={history.page}
          pageSize={history.pageSize}
          total={history.total}
          totalPages={history.totalPages}
          isLoading={history.isLoading}
          isFetching={history.isFetching}
          errorMessage={history.errorMessage}
          setPage={history.setPage}
          setPageSize={history.setPageSize}
          onViewDetails={setDetailTask}
          detailTask={detailTask}
          onDetailOpenChange={(open) => {
            if (!open) setDetailTask(null)
          }}
          runningCount={runningCount}
        />
      </div>
    </div>
  )
}
