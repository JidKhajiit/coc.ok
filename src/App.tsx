import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequirePermission } from './components/RequirePermission'
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
      <Route path="/" element={<Navigate to="/card-trades" replace />} />

      <Route path="/card-trades/verify-email" element={<VerifyEmailPage />} />
      <Route path="/card-trades/reset-password" element={<ResetPasswordPage />} />

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

      <Route path="/card-trades" element={<RequireAuth />}>
        <Route element={<CardTradesPage />}>
          <Route index element={<CardTradesCollectionTab />} />
          <Route path="wishlist" element={<CardTradesWishlistTab />} />
          <Route path="trades" element={<CardTradesTradesTab />} />
          <Route path="trends" element={<CardTradesTrendsTab />} />
        </Route>
      </Route>

      <Route path="/admin-panel" element={<RequirePermission permission="admin:access" />}>
        <Route element={<AdminPage />}>
          <Route index element={<AdminUsersTab />} />
          <Route path="roles" element={<AdminRolesTab />} />
          <Route path="backup" element={<AdminBackupTab />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/card-trades" replace />} />
    </Routes>
  )
}
