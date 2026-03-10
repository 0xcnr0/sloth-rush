import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector'

/**
 * Create Wagmi config based on runtime context.
 *
 * Mini App mode: Uses the Farcaster host app's wallet provider.
 * Standalone mode: Uses RainbowKit with WalletConnect.
 */
export function createWagmiConfig(isMiniApp: boolean) {
  if (isMiniApp) {
    // Inside Farcaster/Base App: wallet provided by host
    return createConfig({
      chains: [baseSepolia],
      transports: {
        [baseSepolia.id]: http(),
      },
      connectors: [farcasterFrame()],
    })
  }

  // Standalone browser: RainbowKit + WalletConnect
  return getDefaultConfig({
    appName: 'Sloth Rush',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'sloth-rush-demo',
    chains: [baseSepolia],
  })
}

// Default export for backward compatibility during transition
// main.tsx will use createWagmiConfig() instead
export const config = getDefaultConfig({
  appName: 'Sloth Rush',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'sloth-rush-demo',
  chains: [baseSepolia],
})
