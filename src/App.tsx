import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequirePermission } from './components/RequirePermission'
import { HomePage } from './pages/HomePage'
import {
  CardTradesCollectionTab,
  CardTradesPage,
  CardTradesTradesTab,
  CardTradesTrendsTab,
  CardTradesWishlistTab,
} from './pages/CardTradesPage'
import { AdminPage, AdminUsersTab, AdminRolesTab, AdminBackupTab } from './pages/AdminPage'
import {
  SharedCollectionCollectionTab,
  SharedCollectionLayout,
  SharedCollectionNeededTab,
} from './pages/SharedCollectionPage'
import { SharedCollectionsListPage } from './pages/SharedCollectionsListPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthEmailPages'
import { PublicAppShell } from './components/PublicAppShell'

export default function App() {
  return (
    <Routes>
      {/* Home page */}
      <Route path="/" element={<HomePage />} />

      {/* Auth pages */}
      <Route path="/card-trades/verify-email" element={<VerifyEmailPage />} />
      <Route path="/card-trades/reset-password" element={<ResetPasswordPage />} />

      {/* Public collections */}
      <Route path="/card-trades/collections" element={<SharedCollectionsListPage />} />
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

      {/* Summer Party event */}
      <Route path="/card-trades/summer-party" element={<RequireAuth />}>
        <Route element={<CardTradesPage />}>
          <Route index element={<CardTradesCollectionTab />} />
          <Route path="wishlist" element={<CardTradesWishlistTab />} />
          <Route path="trades" element={<CardTradesTradesTab />} />
          <Route path="trends" element={<CardTradesTrendsTab />} />
        </Route>
      </Route>

      {/* Legacy redirect */}
      <Route path="/card-trades" element={<Navigate to="/card-trades/summer-party" replace />} />

      {/* Admin panel */}
      <Route path="/admin-panel" element={<RequirePermission permission="admin:access" />}>
        <Route element={<AdminPage />}>
          <Route index element={<AdminUsersTab />} />
          <Route path="roles" element={<AdminRolesTab />} />
          <Route path="backup" element={<AdminBackupTab />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
