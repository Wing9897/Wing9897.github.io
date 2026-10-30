export type EvmNetwork = {
  id: string
  group: string
  label: string
  name: string
  chainId: string
  chainIdInt: number
  rpcUrl: string
  symbol: string
  blockExplorer: string
}

export const EVM_NETWORKS: EvmNetwork[] = [
  {
    id: 'ethereum-mainnet',
    group: '以太坊',
    label: '以太坊主網',
    name: '以太坊主網',
    chainId: '0x1',
    chainIdInt: 1,
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/demo',
    symbol: 'ETH',
    blockExplorer: 'https://etherscan.io',
  },
  {
    id: 'sepolia',
    group: '以太坊',
    label: 'Sepolia 測試網',
    name: 'Sepolia 測試網',
    chainId: '0xaa36a7',
    chainIdInt: 11155111,
    rpcUrl: 'https://eth-sepolia.alchemyapi.io/v2/demo',
    symbol: 'ETH',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    id: 'holesky',
    group: '以太坊',
    label: 'Holesky 測試網',
    name: 'Holesky 測試網',
    chainId: '0x4268',
    chainIdInt: 17000,
    rpcUrl: 'https://eth-holesky.alchemyapi.io/v2/demo',
    symbol: 'ETH',
    blockExplorer: 'https://holesky.etherscan.io',
  },
  {
    id: 'polygon',
    group: '第二層',
    label: 'Polygon（matic）',
    name: 'Polygon',
    chainId: '0x89',
    chainIdInt: 137,
    rpcUrl: 'https://polygon-rpc.com',
    symbol: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
  },
  {
    id: 'arbitrum',
    group: '第二層',
    label: 'Arbitrum One',
    name: 'Arbitrum One',
    chainId: '0xa4b1',
    chainIdInt: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    symbol: 'ETH',
    blockExplorer: 'https://arbiscan.io',
  },
  {
    id: 'optimism',
    group: '第二層',
    label: 'Optimism',
    name: 'Optimism',
    chainId: '0xa',
    chainIdInt: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    symbol: 'ETH',
    blockExplorer: 'https://optimistic.etherscan.io',
  },
  {
    id: 'base',
    group: '第二層',
    label: 'Base',
    name: 'Base',
    chainId: '0x2105',
    chainIdInt: 8453,
    rpcUrl: 'https://mainnet.base.org',
    symbol: 'ETH',
    blockExplorer: 'https://basescan.org',
  },
  {
    id: 'bsc',
    group: '其他',
    label: '幣安智能鏈（BSC）',
    name: '幣安智能鏈',
    chainId: '0x38',
    chainIdInt: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    symbol: 'BNB',
    blockExplorer: 'https://bscscan.com',
  },
  {
    id: 'avalanche',
    group: '其他',
    label: 'Avalanche C-Chain',
    name: 'Avalanche C-Chain',
    chainId: '0xa86a',
    chainIdInt: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    symbol: 'AVAX',
    blockExplorer: 'https://snowtrace.io',
  },
  {
    id: 'fantom',
    group: '其他',
    label: 'Fantom',
    name: 'Fantom',
    chainId: '0xfa',
    chainIdInt: 250,
    rpcUrl: 'https://rpc.ftm.tools',
    symbol: 'FTM',
    blockExplorer: 'https://ftmscan.com',
  },
]

export const NETWORK_GROUPS = ['以太坊', '第二層', '其他'] as const

export function findNetwork(id: string): EvmNetwork | undefined {
  return EVM_NETWORKS.find((network) => network.id === id)
}
