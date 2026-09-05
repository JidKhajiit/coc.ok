import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequirePermission } from './components/RequirePermission'
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
  SharedCollectionLayout,
  SharedCollectionNeededTab,
} from './pages/SharedCollectionPage'
import { SharedCollectionsListPage } from './pages/SharedCollectionsListPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthEmailPages'
import { CozyFarmPage } from './pages/CozyFarmPage'
import { PublicAppShell } from './components/PublicAppShell'

function SummerPartyCollectionsPage() {
  return <SharedCollectionsListPage eventSlug="summer-party" />
}

function EventCollectionsPage() {
  const { eventSlug = '' } = useParams()
  return <SharedCollectionsListPage eventSlug={eventSlug} />
}

export default function App() {
  return (
    <Routes>
      {/* Home page */}
      <Route path="/" element={<HomePage />} />

      {/* Auth pages */}
      <Route path="/card-trades/verify-email" element={<VerifyEmailPage />} />
      <Route path="/card-trades/reset-password" element={<ResetPasswordPage />} />

      {/* Public collections */}
      <Route path="/card-trades/collections" element={<SummerPartyCollectionsPage />} />
      <Route path="/card-trades/:eventSlug/collections" element={<EventCollectionsPage />} />
      <Route
        path="/card-trades/collections/:slug"
        element={
          <PublicAppShell>
            <SharedCollectionLayout />
          </PublicAppShell>
        }
      >
        <Route index element={<SharedCollectionCollectionTab />} />
        <Route path="needed" element={<SharedCollectionNeededTab />} />
      </Route>
      <Route
        path="/card-trades/:eventSlug/collections/:slug"
        element={
          <PublicAppShell>
            <SharedCollectionLayout />
          </PublicAppShell>
        }
      >
        <Route index element={<SharedCollectionCollectionTab />} />
        <Route path="needed" element={<SharedCollectionNeededTab />} />
      </Route>

      {/* Card trade events */}
      <Route path="/card-trades/:eventSlug" element={<RequireAuth />}>
        <Route element={<CardTradesPage />}>
          <Route index element={<CardTradesCollectionTab />} />
          <Route path="wishlist" element={<CardTradesWishlistTab />} />
          <Route path="trades" element={<CardTradesTradesTab />} />
          <Route path="trends" element={<CardTradesTrendsTab />} />
        </Route>
      </Route>

      {/* Card Trades hub */}
      <Route path="/card-trades" element={<CardTradesHubPage />} />

      {/* Cozy Farm event */}
      <Route path="/cozy-farm" element={<RequireAuth />}>
        <Route index element={<CozyFarmPage />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin-panel" element={<RequirePermission permission="admin:access" />}>
        <Route element={<AdminPage />}>
          <Route index element={<AdminUsersTab />} />
          <Route path="roles" element={<AdminRolesTab />} />
          <Route path="backup" element={<AdminBackupTab />} />
          <Route path="events" element={<AdminEventsTab />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
