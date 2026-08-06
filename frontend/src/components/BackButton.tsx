import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  to?: string
  label?: string
}

export default function BackButton({ to, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => to ? navigate(to) : navigate(-1)}
      className="inline-flex items-center gap-1 text-brand-dust hover:text-brand-ink transition-colors text-sm cursor-pointer min-h-[44px] min-w-[44px]"
    >
      <span className="text-lg">{'\u2190'}</span>
      <span>{label}</span>
    </button>
  )
}
