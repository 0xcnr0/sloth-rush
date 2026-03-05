import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

interface WalletGuardProps {
  children: React.ReactNode
  message?: string
}

export default function WalletGuard({ children, message = 'Connect your wallet to continue' }: WalletGuardProps) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl mb-2">{'\u{1F40C}'}</div>
        <p className="text-gray-400 text-center">{message}</p>
        <ConnectButton />
      </div>
    )
  }

  return <>{children}</>
}
