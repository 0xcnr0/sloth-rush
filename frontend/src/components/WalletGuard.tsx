import { useAccount } from 'wagmi'
import WalletConnect from './WalletConnect'
import { THEME } from '../config/theme'

interface WalletGuardProps {
  children: React.ReactNode
  message?: string
}

export default function WalletGuard({ children, message = 'Connect your wallet to continue' }: WalletGuardProps) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl mb-2">{THEME.brand.mark}</div>
        <p className="text-brand-dust text-center">{message}</p>
        <WalletConnect />
      </div>
    )
  }

  return <>{children}</>
}
