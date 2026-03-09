import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Sloth Rush',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'sloth-rush-demo',
  chains: [baseSepolia],
})
