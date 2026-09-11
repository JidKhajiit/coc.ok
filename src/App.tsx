import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequirePermission } from './components/RequirePermission'
import {
  CardTradesEventGuard,
  EventCollectionsPage,
  SharedCollectionGate,
} from './components/EventGates'
import { HomePage } from './pages/HomePage'
import { CardTradesHubPage } from './pages/CardTradesHubPage'
import {
  CardTradesCollectionTab,
  CardTradesPage,
  CardTradesTradesTab,
  CardTradesTrendsTab,
  CardTradesWishlistTab,
} from './pages/CardTradesPage'
import { AdminPage, AdminUsersTab, AdminRolesTab, AdminBackupTab, AdminEventsTab } from './pages/AdminPage'
import {
  SharedCollectionCollectionTab,
  SharedCollectionNeededTab,
} from './pages/SharedCollectionPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthEmailPages'
import { TermsPage } from './pages/TermsPage'
import { CozyFarmPage } from './pages/CozyFarmPage'
import {
  collectionNeededPath,
  collectionPath,
  collectionsListPath,
  eventPath,
} from './lib/events'

/** /card-trades/:event/* → /:event/* */
function LegacyCardTradesEventRedirect() {
  const { eventSlug = '' } = useParams()
  const { pathname, search } = useLocation()
  const rest = pathname.replace(/^\/card-trades\/[^/]+/, '') || ''
  return <Navigate to={`${eventPath(eventSlug)}${rest}${search}`} replace />
}

/** /card-trades/collections → /summer-party/collections */
function LegacySummerPartyListRedirect() {
  return <Navigate to={collectionsListPath('summer-party')} replace />
}

/** /card-trades/collections/:slug(/needed) → /summer-party/:slug(/needed) */
function LegacySummerPartyShareRedirect() {
  const { slug = '' } = useParams()
  const { pathname } = useLocation()
  const to = pathname.endsWith('/needed')
    ? collectionNeededPath('summer-party', slug)
    : collectionPath('summer-party', slug)
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Card-trades hub + auth emails (reserved, not an event slug) */}
      <Route path="/card-trades" element={<CardTradesHubPage />} />
      <Route path="/card-trades/verify-email" element={<VerifyEmailPage />} />
      <Route path="/card-trades/reset-password" element={<ResetPasswordPage />} />

      {/* Legacy /card-trades/{event}/… → /{event}/… */}
      <Route path="/card-trades/collections" element={<LegacySummerPartyListRedirect />} />
      <Route path="/card-trades/collections/:slug" element={<LegacySummerPartyShareRedirect />} />
      <Route path="/card-trades/collections/:slug/needed" element={<LegacySummerPartyShareRedirect />} />
      <Route path="/card-trades/:eventSlug/*" element={<LegacyCardTradesEventRedirect />} />

      {/* Admin */}
      <Route path="/admin-panel" element={<RequirePermission permission="admin:access" />}>
        <Route element={<AdminPage />}>
          <Route index element={<AdminUsersTab />} />
          <Route path="roles" element={<AdminRolesTab />} />
          <Route path="backup" element={<AdminBackupTab />} />
          <Route path="events" element={<AdminEventsTab />} />
        </Route>
      </Route>

      {/* Static event: cozy-farm (outranks /:eventSlug) */}
      <Route path="/cozy-farm" element={<RequireAuth />}>
        <Route index element={<CozyFarmPage />} />
      </Route>

      {/* Public: /{event}/collections */}
      <Route path="/:eventSlug/collections" element={<EventCollectionsPage />} />

      {/* Public share: /{event}/{uid} — dynamic :slug loses to static wishlist/trades/trends */}
      <Route path="/:eventSlug/:slug" element={<SharedCollectionGate />}>
        <Route index element={<SharedCollectionCollectionTab />} />
        <Route path="needed" element={<SharedCollectionNeededTab />} />
      </Route>

      {/* Card-trades event app: /{event}, /{event}/wishlist|trades|trends */}
      <Route path="/:eventSlug" element={<RequireAuth />}>
        <Route element={<CardTradesEventGuard />}>
          <Route element={<CardTradesPage />}>
            <Route index element={<CardTradesCollectionTab />} />
            <Route path="wishlist" element={<CardTradesWishlistTab />} />
            <Route path="trades" element={<CardTradesTradesTab />} />
            <Route path="trends" element={<CardTradesTrendsTab />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
