import { motion } from 'framer-motion'
import { THEME } from '../config/theme'

interface SpinnerProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
}

export default function Spinner({ text = 'Loading...', size = 'md', fullPage = false }: SpinnerProps) {
  const sizeMap = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl' }

  const content = (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        className={sizeMap[size]}
      >
        {THEME.brand.mark}
      </motion.div>
      {text && <p className="text-brand-dust text-sm">{text}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        {content}
      </div>
    )
  }

  return content
}
