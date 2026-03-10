/**
 * MiniAppAutoConnect — Side-effect component for Farcaster Mini App wallet.
 *
 * When running inside Farcaster/Base App, automatically connects the wallet
 * using the host app's provider. Renders nothing.
 *
 * Place this component inside the app tree (e.g., in Layout or App).
 */

import { useEffect } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { isInFarcasterMiniApp } from '../lib/farcaster'

export default function MiniAppAutoConnect() {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (isInFarcasterMiniApp() && !isConnected && connectors.length > 0) {
      connect({ connector: connectors[0] })
    }
  }, [isConnected, connect, connectors])

  return null
}
