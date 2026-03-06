import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, CONTRACTS_DEPLOYED, FREE_SLOTH_ABI, SLOTH_RUSH_ABI, SLOTH_ABI } from '../config/contracts'

// Check if wallet has already minted a Free Sloth on-chain
export function useHasMinted(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.freeSloth,
    abi: FREE_SLOTH_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && !!address },
  })
}

// Mint Free Sloth on-chain
export function useMintFreeSloth() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function mint() {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.freeSloth,
      abi: FREE_SLOTH_ABI,
      functionName: 'mint',
    })
  }

  return { mint, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Upgrade via SlothRush contract on-chain
export function useUpgrade() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function upgrade(freeSlothId: bigint, rarity: number, stats: { spd: number; acc: number; sta: number; agi: number; ref: number; lck: number }) {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.slothRush,
      abi: SLOTH_RUSH_ABI,
      functionName: 'upgrade',
      args: [freeSlothId, rarity, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck],
    })
  }

  return { upgrade, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Read sloth stats from on-chain
export function useSlothStats(tokenId?: bigint) {
  return useReadContract({
    address: CONTRACTS.sloth,
    abi: SLOTH_ABI,
    functionName: 'getStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && tokenId !== undefined },
  })
}
