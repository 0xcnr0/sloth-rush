import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Slug Rush',
  projectId: 'slug-rush-demo', // WalletConnect project ID placeholder
  chains: [baseSepolia],
})
