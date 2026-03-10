import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const SLOTH_RUSH_ADDRESS = '0xda1553aDffDEf8b5fc8C9E344dFf35CC26d60141' as const
const SLOTH_RUSH_ABI = [
  {
    inputs: [
      { name: 'raceId', type: 'bytes32' },
      { name: 'resultHash', type: 'bytes32' },
      { name: 'winner', type: 'address' },
    ],
    name: 'recordRaceResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

let cachedAccount: ReturnType<typeof privateKeyToAccount> | null = null
let cachedClient: ReturnType<typeof createWalletClient> | null = null

function getClient() {
  if (cachedClient && cachedAccount) return { client: cachedClient, account: cachedAccount }
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return null
  cachedAccount = privateKeyToAccount(pk as `0x${string}`)
  cachedClient = createWalletClient({
    account: cachedAccount,
    chain: baseSepolia,
    transport: http(),
  })
  return { client: cachedClient, account: cachedAccount }
}

/**
 * Record race result hash on-chain (optional, best-effort).
 * Skips silently if no DEPLOYER_PRIVATE_KEY is configured.
 */
export async function recordRaceResultOnchain(
  raceId: string,
  resultHash: string,
  winnerWallet: string,
): Promise<string | null> {
  const ctx = getClient()
  if (!ctx) return null

  try {
    const raceIdBytes32 = keccak256(toHex(raceId))
    const resultHashBytes32 = resultHash.startsWith('0x')
      ? (resultHash as `0x${string}`)
      : keccak256(toHex(resultHash))
    const winnerAddr = winnerWallet as `0x${string}`

    const hash = await ctx.client.writeContract({
      address: SLOTH_RUSH_ADDRESS,
      abi: SLOTH_RUSH_ABI,
      functionName: 'recordRaceResult',
      args: [raceIdBytes32, resultHashBytes32, winnerAddr],
      chain: baseSepolia,
      account: ctx.account,
    })

    console.log(`[onchain] Race ${raceId} result recorded: ${hash}`)
    return hash
  } catch (err) {
    console.error('[onchain] Failed to record race result:', err)
    return null
  }
}
