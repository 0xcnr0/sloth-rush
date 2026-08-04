// Contract addresses — update these after deployment to Base Sepolia.
// NOTE: these point at the pre-rename deployment. The contracts were renamed
// (FreeRacer / Racer / RaceCore) but not redeployed; the on-chain bytecode and
// ABIs are unchanged, so these remain valid until a redeploy happens.
export const CONTRACTS = {
  freeRacer: '0x7dF0e4711c2A08164ea9E40834930eb8820E61f4' as `0x${string}`,
  racer: '0xF0CBAB2C3Ae1A0b6B1FB5dd1CF7692CaaA807c0D' as `0x${string}`,
  raceCore: '0xda1553aDffDEf8b5fc8C9E344dFf35CC26d60141' as `0x${string}`,
} as const

// Deployed to Base Sepolia on March 10, 2026
export const CONTRACTS_DEPLOYED = true

// Minimal ABIs — only functions we call from frontend

export const FREE_RACER_ABI = [
  {
    inputs: [],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'hasMinted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const RACER_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getStats',
    outputs: [
      { name: 'rarity', type: 'uint8' },
      { name: 'spd', type: 'uint8' },
      { name: 'acc', type: 'uint8' },
      { name: 'sta', type: 'uint8' },
      { name: 'agi', type: 'uint8' },
      { name: 'ref_', type: 'uint8' },
      { name: 'lck', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const RACE_CORE_ABI = [
  {
    inputs: [
      { name: 'freeRacerId', type: 'uint256' },
      { name: 'rarity', type: 'uint8' },
      { name: 'spd', type: 'uint8' },
      { name: 'acc', type: 'uint8' },
      { name: 'sta', type: 'uint8' },
      { name: 'agi', type: 'uint8' },
      { name: 'ref_', type: 'uint8' },
      { name: 'lck', type: 'uint8' },
    ],
    name: 'upgrade',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
  {
    inputs: [{ name: 'raceId', type: 'bytes32' }],
    name: 'getRaceResult',
    outputs: [
      { name: 'resultHash', type: 'bytes32' },
      { name: 'winner', type: 'address' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const
