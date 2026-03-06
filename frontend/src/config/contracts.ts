// Contract addresses — update these after deployment to Base Sepolia
export const CONTRACTS = {
  freeSloth: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  sloth: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  slothRush: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const

// Set to true after deploying to Base Sepolia
export const CONTRACTS_DEPLOYED = false

// Minimal ABIs — only functions we call from frontend

export const FREE_SLOTH_ABI = [
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

export const SLOTH_ABI = [
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

export const SLOTH_RUSH_ABI = [
  {
    inputs: [
      { name: 'freeSlothId', type: 'uint256' },
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
