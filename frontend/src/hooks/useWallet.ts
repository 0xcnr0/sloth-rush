import { useAccount } from 'wagmi'

/**
 * The connected wallet — or, in development only, a stand-in.
 *
 * Every page in this game is gated on `address`, so without a connected wallet
 * the whole product is a blue wall that says "Connect Wallet". That made the
 * game impossible to review: not one screen past the landing page could be
 * looked at, by a person or by a tool, which is how a race format that is a
 * byte-for-byte duplicate of another one survived this long unnoticed.
 *
 * Passing `?preview=<address>` (or `?preview=1` to use DEV_WALLET) in a dev
 * build stands in for a connection. It is compiled out of production builds by
 * `import.meta.env.DEV`, and it grants nothing the API does not already grant
 * to anyone who knows an address — none of these endpoints verify a signature.
 * When wallet auth is done properly, this goes.
 */
const DEV_WALLET = '0x334a13C2DdC4eE734fC9eA20F6475179690fE2F2'

export function previewAddress(): `0x${string}` | undefined {
  if (!import.meta.env.DEV) return undefined
  const raw = new URLSearchParams(window.location.search).get('preview')
  if (!raw) return undefined
  if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return raw as `0x${string}`
  return DEV_WALLET as `0x${string}`
}

export function useWallet() {
  const { address, isConnected, ...rest } = useAccount()
  const preview = previewAddress()
  return {
    ...rest,
    address: address ?? preview,
    isConnected: isConnected || Boolean(preview),
    /** True when the address came from the dev shim rather than a wallet. */
    isPreview: !address && Boolean(preview),
  }
}
