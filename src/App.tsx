import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import {
  CardTradesCollectionTab,
  CardTradesPage,
  CardTradesTradesTab,
  CardTradesTrendsTab,
  CardTradesWishlistTab,
} from './pages/CardTradesPage'
import {
  SharedCollectionCollectionTab,
  SharedCollectionLayout,
  SharedCollectionNeededTab,
} from './pages/SharedCollectionPage'
import { SharedCollectionsListPage } from './pages/SharedCollectionsListPage'
import { VerifyEmailPage, ResetPasswordPage } from './pages/AuthEmailPages'
import { I18nProvider } from './i18n'

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
          <I18nProvider locale="ru" setLocale={() => {}}>
            <SharedCollectionLayout />
          </I18nProvider>
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

      <Route path="*" element={<Navigate to="/card-trades" replace />} />
    </Routes>
  )
}
