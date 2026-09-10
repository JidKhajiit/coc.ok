type Props = {
  username: string
  avatarUrl?: string | null
  className?: string
}

export function UserAvatar({ username, avatarUrl, className }: Props) {
  const letter = username.slice(0, 1).toUpperCase()
  if (avatarUrl) {
    return (
      <span className={className} aria-hidden>
        <img src={avatarUrl} alt="" className="user-avatar__img" />
      </span>
    )
  }
  return (
    <span className={className} aria-hidden>
      {letter}
    </span>
  )
}
