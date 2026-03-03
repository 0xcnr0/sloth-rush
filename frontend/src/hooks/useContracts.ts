import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, CONTRACTS_DEPLOYED, FREE_SLUG_ABI, SLUG_RUSH_ABI, SNAIL_ABI } from '../config/contracts'

// Check if wallet has already minted a Free Slug on-chain
export function useHasMinted(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.freeSlug,
    abi: FREE_SLUG_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && !!address },
  })
}

// Mint Free Slug on-chain
export function useMintFreeSlug() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function mint() {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.freeSlug,
      abi: FREE_SLUG_ABI,
      functionName: 'mint',
    })
  }

  return { mint, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Upgrade via SlugRush contract on-chain
export function useUpgrade() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function upgrade(freeSlugId: bigint, rarity: number, stats: { spd: number; acc: number; sta: number; agi: number; ref: number; lck: number }) {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.slugRush,
      abi: SLUG_RUSH_ABI,
      functionName: 'upgrade',
      args: [freeSlugId, rarity, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck],
    })
  }

  return { upgrade, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Read snail stats from on-chain
export function useSnailStats(tokenId?: bigint) {
  return useReadContract({
    address: CONTRACTS.snail,
    abi: SNAIL_ABI,
    functionName: 'getStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && tokenId !== undefined },
  })
}
