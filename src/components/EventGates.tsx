import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { isCardTradesEventSlug } from '../lib/events'
import { PublicAppShell } from './PublicAppShell'
import { SharedCollectionLayout } from '../pages/SharedCollectionPage'
import { SharedCollectionsListPage } from '../pages/SharedCollectionsListPage'

/** Auth apps under `/:eventSlug` — only card-trades events (cozy-farm is a static route). */
export function CardTradesEventGuard() {
  const { eventSlug = '' } = useParams()
  const authContext = useOutletContext()
  if (!isCardTradesEventSlug(eventSlug)) {
    return <Navigate to="/" replace />
  }
  return <Outlet context={authContext} />
}

/** Public collection list — card-trades events only. */
export function EventCollectionsPage() {
  const { eventSlug = '' } = useParams()
  if (!isCardTradesEventSlug(eventSlug)) {
    return <Navigate to="/" replace />
  }
  return <SharedCollectionsListPage eventSlug={eventSlug} />
}

/** Public shared collection `/{event}/{uid}` — card-trades only. */
export function SharedCollectionGate() {
  const { eventSlug = '' } = useParams()
  if (!isCardTradesEventSlug(eventSlug)) {
    return <Navigate to="/" replace />
  }
  return (
    <PublicAppShell>
      <SharedCollectionLayout />
    </PublicAppShell>
  )
}
