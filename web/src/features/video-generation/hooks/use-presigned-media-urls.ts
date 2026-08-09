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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { presignMediaObjectKeys } from '../media-api'

type UsePresignedMediaUrlsResult = {
  urlMap: Record<string, string>
  isPresigning: boolean
  errorMessage: string | null
  refresh: () => void
}

/** 与后端 mediaGetURLExpiry(24h) 对齐，在剩余约 10% 寿命时刷新。 */
const MEDIA_URL_REFRESH_AFTER_MS = Math.floor(24 * 60 * 60 * 1000 * 0.9)

function stableObjectKeysKey(objectKeys: string[]): string {
  return objectKeys.join('\0')
}

/** 对 object_key 列表批量预签名；keys 变化、手动 refresh 或临近过期时重新请求。 */
export function usePresignedMediaUrls(
  objectKeys: string[],
  enabled: boolean
): UsePresignedMediaUrlsResult {
  const keysKey = stableObjectKeysKey(objectKeys)
  const keys = useMemo(() => {
    if (!keysKey) return [] as string[]
    return keysKey.split('\0').filter(Boolean)
  }, [keysKey])

  const [urlMap, setUrlMap] = useState<Record<string, string>>({})
  const [isPresigning, setIsPresigning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastManualRefreshAtRef = useRef(0)

  const refresh = useCallback(() => {
    const now = Date.now()
    // 防止媒体错误回调在短时间内打爆 presign-get
    if (now - lastManualRefreshAtRef.current < 5_000) return
    lastManualRefreshAtRef.current = now
    setRefreshNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled || keys.length === 0) {
      setUrlMap({})
      setIsPresigning(false)
      setErrorMessage(null)
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }
      return
    }

    const controller = new AbortController()
    setIsPresigning(true)
    setErrorMessage(null)

    void presignMediaObjectKeys(keys, controller.signal)
      .then((urls) => {
        if (controller.signal.aborted) return
        setUrlMap(urls)
        if (expiryTimerRef.current) {
          clearTimeout(expiryTimerRef.current)
        }
        expiryTimerRef.current = setTimeout(() => {
          setRefreshNonce((value) => value + 1)
        }, MEDIA_URL_REFRESH_AFTER_MS)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'Failed to presign media'
        setErrorMessage(message)
        setUrlMap({})
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPresigning(false)
        }
      })

    return () => {
      controller.abort()
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }
    }
  }, [enabled, keys, refreshNonce])

  return { urlMap, isPresigning, errorMessage, refresh }
}
