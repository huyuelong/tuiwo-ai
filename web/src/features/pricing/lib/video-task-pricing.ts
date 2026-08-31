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
import { formatCurrencyFromUSD } from '@/lib/currency'

import { QUOTA_TYPE_VALUES } from '../constants'
import type { PricingModel } from '../types'
import { getConfiguredGroupRatio } from './model-helpers'

export type VideoResolutionTier = {
  label: string
  multiplier: number
}

export type VideoTaskPricingProfile = {
  id: 'wan30'
  modelNames: readonly string[]
  resolutionTiers: readonly VideoResolutionTier[]
  minDurationSeconds: number
  maxDurationSeconds: number
  defaultDurationSeconds: number
  smartDurationPrechargeSeconds: number
}

const WAN30_RESOLUTION_TIERS: readonly VideoResolutionTier[] = [
  { label: '480P', multiplier: 1 },
  { label: '720P', multiplier: 2 },
  { label: '1080P', multiplier: 4 },
]

export const WAN30_VIDEO_TASK_PROFILE: VideoTaskPricingProfile = {
  id: 'wan30',
  modelNames: ['wan3.0-video', 'wan3.0-video-prime'],
  resolutionTiers: WAN30_RESOLUTION_TIERS,
  minDurationSeconds: 2,
  maxDurationSeconds: 30,
  defaultDurationSeconds: 5,
  smartDurationPrechargeSeconds: 30,
}

const VIDEO_TASK_PRICING_PROFILES: readonly VideoTaskPricingProfile[] = [
  WAN30_VIDEO_TASK_PROFILE,
]

export function getVideoTaskPricingProfile(
  modelName: string
): VideoTaskPricingProfile | null {
  const normalized = modelName.trim().toLowerCase()
  return (
    VIDEO_TASK_PRICING_PROFILES.find((profile) =>
      profile.modelNames.some((name) => name.toLowerCase() === normalized)
    ) ?? null
  )
}

export function isVideoTaskPricingModel(model: PricingModel): boolean {
  return getVideoTaskPricingProfile(model.model_name) != null
}

/** Admin-configured base unit price in USD before duration/resolution multipliers. */
export function getVideoTaskBaseUnitPriceUSD(model: PricingModel): number | null {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    const price = model.model_price
    return price != null && Number.isFinite(price) && price > 0 ? price : null
  }

  const ratio = model.model_ratio
  if (ratio != null && Number.isFinite(ratio) && ratio > 0) {
    return ratio * 2
  }

  return null
}

export function calculateVideoTaskPriceUSD(args: {
  baseUnitPriceUSD: number
  durationSeconds: number
  resolutionMultiplier: number
  groupRatio?: number
}): number {
  const groupRatio =
    args.groupRatio != null && Number.isFinite(args.groupRatio)
      ? args.groupRatio
      : 1
  return (
    args.baseUnitPriceUSD *
    args.durationSeconds *
    args.resolutionMultiplier *
    groupRatio
  )
}

export function getVideoTaskResolutionMultiplier(
  profile: VideoTaskPricingProfile,
  resolutionLabel: string
): number {
  const tier = profile.resolutionTiers.find(
    (item) => item.label.toUpperCase() === resolutionLabel.toUpperCase()
  )
  return tier?.multiplier ?? 1
}

export type VideoTaskExamplePrice = {
  durationSeconds: number
  resolutionLabel: string
  resolutionMultiplier: number
  priceUSD: number
}

export function buildVideoTaskExamplePrices(args: {
  model: PricingModel
  profile: VideoTaskPricingProfile
  groupRatio?: number
  durations?: readonly number[]
  resolutions?: readonly string[]
}): VideoTaskExamplePrice[] {
  const baseUnitPriceUSD = getVideoTaskBaseUnitPriceUSD(args.model)
  if (baseUnitPriceUSD == null) {
    return []
  }

  const durations = args.durations ?? [5, 10, 30]
  const resolutions =
    args.resolutions ??
    args.profile.resolutionTiers.map((tier) => tier.label)
  const groupRatio = args.groupRatio ?? 1
  const examples: VideoTaskExamplePrice[] = []

  for (const durationSeconds of durations) {
    for (const resolutionLabel of resolutions) {
      const resolutionMultiplier = getVideoTaskResolutionMultiplier(
        args.profile,
        resolutionLabel
      )
      examples.push({
        durationSeconds,
        resolutionLabel,
        resolutionMultiplier,
        priceUSD: calculateVideoTaskPriceUSD({
          baseUnitPriceUSD,
          durationSeconds,
          resolutionMultiplier,
          groupRatio,
        }),
      })
    }
  }

  return examples
}

export function getVideoTaskGroupBaseUnitPriceUSD(args: {
  model: PricingModel
  group: string
  groupRatio: Record<string, number>
}): number | null {
  const baseUnitPriceUSD = getVideoTaskBaseUnitPriceUSD(args.model)
  if (baseUnitPriceUSD == null) {
    return null
  }
  return (
    baseUnitPriceUSD * getConfiguredGroupRatio(args.groupRatio, args.group)
  )
}

export function applyRechargeAdjustedUSD(
  priceUSD: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) {
    return priceUSD
  }
  return (priceUSD * priceRate) / usdExchangeRate
}

export function formatVideoTaskPriceUSD(
  priceUSD: number,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1
): string {
  return formatCurrencyFromUSD(
    applyRechargeAdjustedUSD(
      priceUSD,
      showWithRecharge,
      priceRate,
      usdExchangeRate
    ),
    {
      digitsLarge: 6,
      digitsSmall: 6,
      abbreviate: false,
    }
  )
}
