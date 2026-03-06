import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Sloth Rush',
  projectId: 'sloth-rush-demo', // WalletConnect project ID placeholder
  chains: [baseSepolia],
})
