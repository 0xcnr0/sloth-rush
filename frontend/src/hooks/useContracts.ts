import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, CONTRACTS_DEPLOYED, FREE_RACER_ABI, RACE_CORE_ABI, RACER_ABI } from '../config/contracts'

// Check if wallet has already minted a Free Racer on-chain
export function useHasMinted(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.freeRacer,
    abi: FREE_RACER_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && !!address },
  })
}

// Mint Free Racer on-chain
export function useMintFreeRacer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function mint() {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.freeRacer,
      abi: FREE_RACER_ABI,
      functionName: 'mint',
    })
  }

  return { mint, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Upgrade via RaceCore contract on-chain
export function useUpgrade() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function upgrade(freeRacerId: bigint, rarity: number, stats: { spd: number; acc: number; sta: number; agi: number; ref: number; lck: number }) {
    if (!CONTRACTS_DEPLOYED) return
    writeContract({
      address: CONTRACTS.raceCore,
      abi: RACE_CORE_ABI,
      functionName: 'upgrade',
      args: [freeRacerId, rarity, stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck],
    })
  }

  return { upgrade, hash, isPending, isConfirming, isSuccess, error, isDeployed: CONTRACTS_DEPLOYED }
}

// Read racer stats from on-chain
export function useRacerStats(tokenId?: bigint) {
  return useReadContract({
    address: CONTRACTS.racer,
    abi: RACER_ABI,
    functionName: 'getStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: CONTRACTS_DEPLOYED && tokenId !== undefined },
  })
}
