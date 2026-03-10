import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { Toaster } from 'react-hot-toast'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'
import App from './App'
import { createWagmiConfig } from './config/wagmi'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initFarcaster, isInFarcasterMiniApp } from './lib/farcaster'

const queryClient = new QueryClient()

/**
 * Async bootstrap — detects Mini App context before rendering React.
 *
 * When inside Farcaster/Base App: skips RainbowKitProvider, uses host wallet.
 * When in standalone browser: renders normally with RainbowKit.
 *
 * initFarcaster() resolves quickly (~100ms) even outside a Mini App.
 */
async function bootstrap() {
  await initFarcaster()

  const isMiniApp = isInFarcasterMiniApp()
  const wagmiConfig = createWagmiConfig(isMiniApp)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            {isMiniApp ? (
              // Mini App mode: wallet provided by host, no RainbowKit needed
              <BrowserRouter>
                <App />
              </BrowserRouter>
            ) : (
              // Standalone mode: RainbowKit for wallet connection UI
              <RainbowKitProvider theme={darkTheme({ accentColor: '#22c55e' })}>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </RainbowKitProvider>
            )}
          </QueryClientProvider>
        </WagmiProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }} />
      </ErrorBoundary>
    </StrictMode>,
  )
}

bootstrap()
