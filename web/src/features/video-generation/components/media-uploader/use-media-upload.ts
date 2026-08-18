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
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  completeMediaUpload,
  initiateMediaUpload,
} from '../../media-api'
import type { MediaAsset, MediaCategory } from '../../profiles/types'
import { validateMediaUrlForCategory } from './url-media-validation'
import { xhrPutFile } from './xhr-put'

type UploadItemState = {
  localId: string
  name: string
  progress: number
  status: 'uploading' | 'error'
  error?: string
  file?: File
}

type UseMediaUploadOptions = {
  category: MediaCategory
  maxCount: number
  maxSizeBytes?: number
  disabled?: boolean
  value: MediaAsset[]
  onChange: (next: MediaAsset[]) => void
}

/** 同批多文件上传并发上限，避免打满发起接口与日额度竞态 */
const MEDIA_UPLOAD_CONCURRENCY = 3

function createLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useMediaUpload(options: UseMediaUploadOptions) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<UploadItemState[]>([])
  const abortMapRef = useRef<Map<string, AbortController>>(new Map())

  const remainingSlots = Math.max(0, options.maxCount - options.value.length)

  const cancelUpload = useCallback((localId: string) => {
    const controller = abortMapRef.current.get(localId)
    controller?.abort()
    abortMapRef.current.delete(localId)
    setPending((prev) => prev.filter((item) => item.localId !== localId))
  }, [])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (options.disabled) return
      const list = Array.from(files)
      if (list.length === 0) return

      const capacity = Math.max(0, options.maxCount - options.value.length)
      if (capacity <= 0) {
        toast.error(t('Maximum number of files reached'))
        return
      }

      const selected = list.slice(0, capacity)
      const uploaded: MediaAsset[] = []

      const workItems: { file: File; localId: string }[] = []
      for (const file of selected) {
        if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
          toast.error(
            t('File exceeds the size limit: {{name}}', { name: file.name })
          )
          continue
        }
        const localId = createLocalId()
        const controller = new AbortController()
        abortMapRef.current.set(localId, controller)
        workItems.push({ file, localId })
        setPending((prev) => [
          ...prev,
          {
            localId,
            name: file.name,
            progress: 0,
            status: 'uploading',
            file,
          },
        ])
      }

      const runOne = async (
        file: File,
        localId: string
      ): Promise<MediaAsset | null> => {
        const controller = abortMapRef.current.get(localId)
        try {
          const initiated = await initiateMediaUpload({
            filename: file.name,
            content_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          })

          await xhrPutFile({
            url: initiated.put_url,
            file,
            headers: initiated.headers,
            signal: controller?.signal,
            onProgress: (percent) => {
              setPending((prev) =>
                prev.map((item) =>
                  item.localId === localId
                    ? { ...item, progress: percent }
                    : item
                )
              )
            },
          })

          const completed = await completeMediaUpload({
            upload_id: initiated.upload_id,
          })

          setPending((prev) => prev.filter((item) => item.localId !== localId))
          return {
            uploadId: completed.upload_id,
            key: completed.object_key,
            url: completed.get_url,
            name: completed.filename || file.name,
            mime: completed.content_type || file.type,
            size: completed.size_bytes || file.size,
          }
        } catch (error) {
          if ((error as { name?: string })?.name === 'AbortError') {
            setPending((prev) => prev.filter((item) => item.localId !== localId))
            return null
          }
          const message =
            error instanceof Error ? error.message : t('Upload failed')
          setPending((prev) =>
            prev.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    status: 'error',
                    error: message,
                    progress: 0,
                    file,
                  }
                : item
            )
          )
          toast.error(message)
          return null
        } finally {
          abortMapRef.current.delete(localId)
        }
      }

      for (
        let start = 0;
        start < workItems.length;
        start += MEDIA_UPLOAD_CONCURRENCY
      ) {
        const batch = workItems.slice(start, start + MEDIA_UPLOAD_CONCURRENCY)
        const settled = await Promise.allSettled(
          batch.map((item) => runOne(item.file, item.localId))
        )
        for (const result of settled) {
          if (result.status === 'fulfilled' && result.value) {
            uploaded.push(result.value)
          }
        }
      }

      if (uploaded.length > 0) {
        options.onChange(
          [...options.value, ...uploaded].slice(0, options.maxCount)
        )
      }
    },
    [options, t]
  )

  const retryUpload = useCallback(
    (localId: string) => {
      const item = pending.find((entry) => entry.localId === localId)
      if (!item?.file || item.status !== 'error') return
      setPending((prev) => prev.filter((entry) => entry.localId !== localId))
      void uploadFiles([item.file])
    },
    [pending, uploadFiles]
  )

  const removeAsset = useCallback(
    (index: number) => {
      options.onChange(options.value.filter((_, i) => i !== index))
    },
    [options]
  )

  const addFromUrl = useCallback(
    (rawUrl: string) => {
      const url = rawUrl.trim()
      if (!url) return
      try {
        // 校验 URL 形态
        // eslint-disable-next-line no-new
        new URL(url)
      } catch {
        toast.error(t('Please enter a valid URL'))
        return
      }
      const categoryCheck = validateMediaUrlForCategory(url, options.category)
      if (!categoryCheck.ok) {
        toast.error(t(categoryCheck.messageKey))
        return
      }
      if (options.value.length >= options.maxCount) {
        toast.error(t('Maximum number of files reached'))
        return
      }
      const name = url.split('/').pop() || url
      let mime = 'application/octet-stream'
      if (options.category === 'image') {
        mime = 'image/*'
      } else if (options.category === 'video') {
        mime = 'video/*'
      } else if (options.category === 'audio') {
        mime = 'audio/*'
      }
      options.onChange([
        ...options.value,
        {
          url,
          name,
          mime,
          size: 0,
        },
      ])
    },
    [options, t]
  )

  return {
    pending,
    remainingSlots,
    uploadFiles,
    cancelUpload,
    retryUpload,
    removeAsset,
    addFromUrl,
  }
}
