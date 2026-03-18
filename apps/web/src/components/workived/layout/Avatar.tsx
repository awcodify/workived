import { getAvatarColor } from '@/design/tokens'

interface AvatarProps {
  name: string
  id: string
  size?: number
}

export function Avatar({ name, id, size = 32 }: AvatarProps) {
  const { bg, text } = getAvatarColor(id)
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="grid place-items-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 40 ? 12 : 9,
        background: bg,
        color: text,
        fontSize: size * 0.34,
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  )
}
