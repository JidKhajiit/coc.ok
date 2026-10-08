import { useEffect, useState } from 'react'
import * as api from '../api/client'
import type { CardOfferCounts } from '../api/client'

export function useOfferCounts(eventSlug: string): CardOfferCounts {
  const [offerCounts, setOfferCounts] = useState<CardOfferCounts>({})

  useEffect(() => {
    let cancelled = false
    void api
      .getEventCardOfferCounts(eventSlug)
      .then((counts) => {
        if (!cancelled) setOfferCounts(counts)
      })
      .catch(() => {
        if (!cancelled) setOfferCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  return offerCounts
}
