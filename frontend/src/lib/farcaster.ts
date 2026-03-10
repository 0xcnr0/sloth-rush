/**
 * Farcaster Mini App SDK — Initialization & Utilities
 *
 * Handles SDK initialization, context detection, and provides utilities
 * for the rest of the app. Must be called before React render.
 *
 * When running outside a Mini App (standalone browser), all functions
 * are safe no-ops that return null/false.
 */

import { sdk } from '@farcaster/miniapp-sdk'

let initialized = false
let miniAppActive = false
let contextData: any = null

/**
 * Initialize the Farcaster Mini App SDK.
 * Must be called early in app lifecycle (before React render).
 * When running outside a Mini App, resolves quickly as a no-op.
 */
export async function initFarcaster(): Promise<boolean> {
  if (initialized) return miniAppActive

  try {
    const context = await sdk.context
    if (context) {
      contextData = context
      miniAppActive = true

      // Tell the host app we're ready — hides the splash/loading screen
      sdk.actions.ready()

      console.log('[SlothRush] Running as Farcaster Mini App, FID:', context.user?.fid)
    }
  } catch (err) {
    console.log('[SlothRush] Not in Mini App context (standalone browser)')
    miniAppActive = false
  }

  initialized = true
  return miniAppActive
}

/**
 * Check if running inside a Farcaster Mini App.
 * Synchronous — only valid after initFarcaster() has been called.
 */
export function isInFarcasterMiniApp(): boolean {
  return miniAppActive
}

/**
 * Get the Farcaster context (user info, client info, safe area insets).
 * Returns null when not in a Mini App.
 */
export function getFarcasterContext() {
  return contextData
}

/**
 * Get the Farcaster user's FID (Farcaster ID).
 * Returns null when not in a Mini App.
 */
export function getFarcasterFid(): number | null {
  return contextData?.user?.fid ?? null
}

/**
 * Get safe area insets from the host app (for notch/status bar handling).
 * Returns { top: 0, bottom: 0, left: 0, right: 0 } when not in a Mini App.
 */
export function getSafeAreaInsets() {
  if (!contextData?.client?.safeAreaInsets) {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
  return contextData.client.safeAreaInsets
}

// Re-export the SDK for advanced usage (composeCast, openUrl, etc.)
export { sdk as farcasterSdk }
