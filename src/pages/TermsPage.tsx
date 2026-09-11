import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../brand'
import { useI18n } from '../i18n'
import { PublicAppShell } from '../components/PublicAppShell'
import '../App.css'

function TermsContent() {
  const { t } = useI18n()

  return (
    <div className="legal-page">
      <div className="atmosphere" aria-hidden />
      <article className="legal-page__card">
        <p className="legal-page__brand">{BRAND_NAME}</p>
        <h1 className="legal-page__title">{t('legal.termsTitle')}</h1>
        <div className="legal-page__body">
          <p>{t('legal.termsIntro')}</p>
          <p>{t('legal.termsAsIs')}</p>
          <p>{t('legal.termsLiability')}</p>
          <p>{t('legal.termsPrivacy')}</p>
          <p>{t('legal.termsCookies')}</p>
        </div>
        <p className="legal-page__nav">
          <Link to="/" className="auth__link">
            {t('legal.backHome')}
          </Link>
        </p>
      </article>
    </div>
  )
}

export function TermsPage() {
  return (
    <PublicAppShell>
      <TermsContent />
    </PublicAppShell>
  )
}
