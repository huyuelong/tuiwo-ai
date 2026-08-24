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
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { downloadVideoContent } from '../lib/download-video'

type VideoDownloadButtonProps = {
  taskId: string
  size?: 'sm' | 'default'
  className?: string
}

export function VideoDownloadButton(props: VideoDownloadButtonProps) {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const taskId = props.taskId.trim()
  if (!taskId) return null

  return (
    <Button
      type='button'
      variant='outline'
      size={props.size ?? 'sm'}
      className={props.className}
      disabled={downloading}
      onClick={() => {
        setDownloading(true)
        void downloadVideoContent(taskId)
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : t('Download failed')
            toast.error(message)
          })
          .finally(() => {
            setDownloading(false)
          })
      }}
    >
      {downloading ? (
        <Loader2 className='size-4 animate-spin' aria-hidden />
      ) : (
        <Download className='size-4' aria-hidden />
      )}
      {downloading ? t('Downloading…') : t('Download video')}
    </Button>
  )
}
