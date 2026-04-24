type AccountAvatarProps = {
  login: string
  avatarUrl: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
}

export default function AccountAvatar({ login, avatarUrl, size = 'md' }: AccountAvatarProps) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={login}
        className={`${sizeMap[size]} rounded-full object-cover`}
      />
    )
  }

  return (
    <div
      className={`${sizeMap[size]} flex items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700`}
    >
      {login.charAt(0).toUpperCase()}
    </div>
  )
}
