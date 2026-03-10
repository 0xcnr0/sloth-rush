/**
 * WalletConnect — Adaptive wallet connection component.
 *
 * Mini App mode: Returns null (wallet provided by host app).
 * Standalone mode: Renders RainbowKit's ConnectButton.
 *
 * This wrapper exists so that all 10+ files that render ConnectButton
 * don't need individual Mini App detection logic.
 */

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { isInFarcasterMiniApp } from '../lib/farcaster'

type WalletConnectProps = Parameters<typeof ConnectButton>[0]

export default function WalletConnect(props: WalletConnectProps) {
  // In Mini App mode, wallet is auto-connected by host — no button needed
  if (isInFarcasterMiniApp()) {
    return null
  }

  // Standalone browser: render RainbowKit ConnectButton
  return <ConnectButton {...props} />
}
