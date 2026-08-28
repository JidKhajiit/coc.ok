import { useI18n } from '../i18n'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

export function SearchField({ value, onChange, placeholder, autoFocus, className }: Props) {
  const { t } = useI18n()
  return (
    <div className={`search-field ${className ?? ''}`}>
      <input
        className="input search-field__input"
        type="search"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.length > 0 && (
        <button
          type="button"
          className="search-field__clear"
          onClick={() => onChange('')}
          aria-label={t('common.clearSearch')}
        >
          ×
        </button>
      )}
    </div>
  )
}
