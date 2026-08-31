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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'

import type { PricingModel } from '../types'
import {
  buildVideoTaskExamplePrices,
  formatVideoTaskPriceUSD,
  getVideoTaskBaseUnitPriceUSD,
  getVideoTaskPricingProfile,
  type VideoTaskPricingProfile,
} from '../lib/video-task-pricing'

export interface VideoTaskPricingBreakdownProps {
  model: PricingModel
  groupRatio?: number
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
}

function DurationRules(props: { profile: VideoTaskPricingProfile }) {
  const { t } = useTranslation()
  const profile = props.profile

  return (
    <ul className='text-muted-foreground space-y-1 text-xs leading-relaxed'>
      <li>
        {t('Video duration range {{min}}–{{max}} seconds', {
          min: profile.minDurationSeconds,
          max: profile.maxDurationSeconds,
        })}
      </li>
      <li>
        {t('Defaults to {{seconds}} seconds when duration is omitted', {
          seconds: profile.defaultDurationSeconds,
        })}
      </li>
      <li>
        {t(
          'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration',
          { seconds: profile.smartDurationPrechargeSeconds }
        )}
      </li>
    </ul>
  )
}

export function VideoTaskPricingBreakdown(
  props: VideoTaskPricingBreakdownProps
) {
  const { t } = useTranslation()
  const showRechargePrice = props.showRechargePrice ?? false
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const groupRatio = props.groupRatio ?? 1

  const profile = getVideoTaskPricingProfile(props.model.model_name)
  const baseUnitPriceUSD = getVideoTaskBaseUnitPriceUSD(props.model)

  const exampleMatrix = useMemo(() => {
    if (!profile || baseUnitPriceUSD == null) {
      return []
    }
    return buildVideoTaskExamplePrices({
      model: props.model,
      profile,
      groupRatio,
      durations: [5, 10, 30],
    })
  }, [baseUnitPriceUSD, groupRatio, profile, props.model])

  if (!profile) {
    return null
  }

  const thClass =
    'text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase'

  const formatPrice = (priceUSD: number) =>
    formatVideoTaskPriceUSD(
      priceUSD,
      showRechargePrice,
      priceRate,
      usdExchangeRate
    )

  return (
    <div className='space-y-4'>
      <div className='rounded-lg border border-violet-200/70 bg-violet-50/60 p-3 dark:border-violet-500/20 dark:bg-violet-500/10'>
        <div className='text-sm font-medium text-violet-900 dark:text-violet-100'>
          {t('Video duration billing')}
        </div>
        <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
          {t(
            'Price = base unit × duration (seconds) × resolution multiplier × group ratio'
          )}
        </p>
        {baseUnitPriceUSD != null ? (
          <div className='mt-3 flex items-baseline justify-between gap-4'>
            <span className='text-muted-foreground text-sm'>
              {t('Base unit price (480P per second)')}
            </span>
            <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
              {formatPrice(baseUnitPriceUSD * groupRatio)}
            </span>
          </div>
        ) : (
          <p className='text-muted-foreground mt-2 text-xs'>
            {t('Base unit price is not configured for this model.')}
          </p>
        )}
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase'>
            {t('Resolution multiplier')}
          </div>
          <div className='space-y-1.5'>
            {profile.resolutionTiers.map((tier) => (
              <div
                key={tier.label}
                className='flex items-baseline justify-between gap-4 text-sm'
              >
                <span className='text-foreground font-medium'>{tier.label}</span>
                <span className='text-muted-foreground font-mono tabular-nums'>
                  {tier.multiplier}x
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase'>
            {t('Duration rules')}
          </div>
          <DurationRules profile={profile} />
        </div>
      </div>

      {exampleMatrix.length > 0 && (
        <div>
          <div className='text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase'>
            {t('Example prices')}
          </div>
          <StaticDataTable
            className='rounded-lg border'
            tableClassName='text-sm'
            headerRowClassName='hover:bg-transparent'
            data={[...profile.resolutionTiers]}
            getRowKey={(tier) => tier.label}
            columns={[
              {
                id: 'resolution',
                header: t('Resolution'),
                className: thClass,
                cellClassName: 'py-2.5 font-medium',
                cell: (tier) => tier.label,
              },
              {
                id: 'multiplier',
                header: t('Multiplier'),
                className: thClass,
                cellClassName: 'text-muted-foreground py-2.5 font-mono',
                cell: (tier) => `${tier.multiplier}x`,
              },
              {
                id: '5s',
                header: '5s',
                className: `${thClass} text-right`,
                cellClassName: 'py-2.5 text-right font-mono',
                cell: (tier) => {
                  const example = exampleMatrix.find(
                    (item) =>
                      item.durationSeconds === 5 &&
                      item.resolutionLabel === tier.label
                  )
                  return example ? formatPrice(example.priceUSD) : '-'
                },
              },
              {
                id: '10s',
                header: '10s',
                className: `${thClass} text-right`,
                cellClassName: 'py-2.5 text-right font-mono',
                cell: (tier) => {
                  const example = exampleMatrix.find(
                    (item) =>
                      item.durationSeconds === 10 &&
                      item.resolutionLabel === tier.label
                  )
                  return example ? formatPrice(example.priceUSD) : '-'
                },
              },
              {
                id: '30s',
                header: '30s',
                className: `${thClass} text-right`,
                cellClassName: 'py-2.5 text-right font-mono',
                cell: (tier) => {
                  const example = exampleMatrix.find(
                    (item) =>
                      item.durationSeconds === 30 &&
                      item.resolutionLabel === tier.label
                  )
                  return example ? formatPrice(example.priceUSD) : '-'
                },
              },
            ]}
          />
          <p className='text-muted-foreground/60 mt-1.5 text-[10px]'>
            {t(
              'Final charge may differ when smart duration is used or when the upstream returns a different duration.'
            )}
          </p>
        </div>
      )}
    </div>
  )
}
