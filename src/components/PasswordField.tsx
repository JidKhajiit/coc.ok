import { useState } from 'react'
import { useI18n } from '../i18n'

type Props = {
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  label: string
}

export function PasswordField({ value, onChange, autoComplete, label }: Props) {
  const { t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <label className="auth__field">
      <span>{label}</span>
      <span className="auth__password-wrap">
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          className={showPassword ? '' : 'auth__password--spoiled'}
        />
        <button
          type="button"
          className="auth__password-toggle"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </span>
    </label>
  )
}

export function AuthMessage({
  error,
  info,
}: {
  error?: string | null
  info?: string | null
}) {
  return (
    <>
      {error && (
        <p className="auth__error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="auth__info" role="status">
          {info}
        </p>
      )}
    </>
  )
}

function EyeOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 12 14.5 2.5 2.5 0 0 1 9.5 12 2.5 2.5 0 0 1 12 9.5m0-2a4.5 4.5 0 0 0-4.5 4.5A4.5 4.5 0 0 0 12 16.5 4.5 4.5 0 0 0 16.5 12 4.5 4.5 0 0 0 12 7.5z"
      />
    </svg>
  )
}

function EyeClosedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.88 1.79-2.28 3.28-4 4.22L15.41 13A2 2 0 0 0 15 12a2 2 0 0 0-2-2c-.18 0-.35.03-.51.08l-1.85-1.85A6.47 6.47 0 0 1 12 6.5M3.27 3 2 4.27l2.79 2.79C3.53 8.47 2.22 10.13 1 12c1.73 4.39 6 7.5 11 7.5 1.94 0 3.77-.45 5.4-1.24L20.73 22 22 20.73 3.27 3m6.36 6.36 1.55 1.55A2 2 0 0 0 12 14.5c.34 0 .66-.09.94-.24l1.55 1.55A4.48 4.48 0 0 1 12 16.5c-2.48 0-4.5-2.02-4.5-4.5 0-.79.2-1.53.55-2.18l1.86 1.54zM12 9.5a2.5 2.5 0 0 1 2.45 2h-2.45V9.5m4.95 5.12 1.41 1.41A10.9 10.9 0 0 1 12 19.5C7 19.5 2.73 16.39 1 12a11.8 11.8 0 0 1 4.58-5.24l1.53 1.53A6.47 6.47 0 0 0 6.5 12c0 3.04 2.46 5.5 5.5 5.5 1.07 0 2.07-.31 2.92-.84z"
      />
    </svg>
  )
}
