
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
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
              // Standalone mode: RainbowKit for wallet connection UI.
              // The wallet modal is the one surface this app does not draw
              // itself, so it has to be told the palette or it renders a dark
              // sheet with a green button in the middle of a lit toy shelf.
              <RainbowKitProvider
                theme={lightTheme({
                  accentColor: '#241A38',
                  accentColorForeground: '#FFFDF7',
                  borderRadius: 'large',
                })}
              >
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </RainbowKitProvider>
            )}
          </QueryClientProvider>
        </WagmiProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#FFFDF7', color: '#241A38', border: '1px solid #9AA6B2' },
          success: { iconTheme: { primary: '#4CAF6D', secondary: '#FFFDF7' } },
          error: { iconTheme: { primary: '#E63946', secondary: '#FFFDF7' } },
        }} />
      </ErrorBoundary>
    </StrictMode>,
  )
}

bootstrap()
