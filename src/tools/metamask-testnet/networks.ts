export type ChainConfig = {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

export type TokenConfig = {
  id: string
  address: string
  symbol: string
  decimals: number
  name: string
  network: string
}

export const SEPOLIA_TESTNET: ChainConfig = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia Test Network',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.infura.io'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
}

export const POLYGON_AMOY_TESTNET: ChainConfig = {
  chainId: '0x13882',
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  blockExplorerUrls: ['https://amoy.polygonscan.com'],
}

export const BSC_TESTNET: ChainConfig = {
  chainId: '0x61',
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export const SEPOLIA_PYUSD: TokenConfig = {
  id: 'sepolia-pyusd',
  address: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
  symbol: 'PYUSD',
  decimals: 6,
  name: 'PayPal USD',
  network: 'Ethereum Sepolia 測試網',
}

export const SEPOLIA_USDC: TokenConfig = {
  id: 'sepolia-usdc',
  address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  network: 'Ethereum Sepolia 測試網',
}

export const AMOY_USDC: TokenConfig = {
  id: 'amoy-usdc',
  address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  network: 'Polygon Amoy 測試網',
}

const NETWORK_NAMES: Record<string, string> = {
  '0x1': 'Ethereum 主網',
  '0xaa36a7': 'Ethereum Sepolia 測試網',
  '0x13882': 'Polygon Amoy 測試網',
  '0x61': 'BNB Smart Chain Testnet',
}

const NETWORK_SYMBOLS: Record<string, string> = {
  '0x1': 'ETH',
  '0xaa36a7': 'ETH',
  '0x13882': 'POL',
  '0x61': 'tBNB',
}

const EXPLORER_NAMES: Record<string, string> = {
  '0x1': 'Etherscan',
  '0xaa36a7': 'Sepolia Etherscan',
  '0x13882': 'Amoy Polygonscan',
  '0x61': 'BSC Testnet Explorer',
}

export function normalizeChainId(chainId: string): string {
  return chainId.toLowerCase()
}

export function networkName(chainId: string): string {
  const id = normalizeChainId(chainId)
  return NETWORK_NAMES[id] ?? `未知網絡 (${chainId})`
}

export function networkSymbol(chainId: string): string {
  return NETWORK_SYMBOLS[normalizeChainId(chainId)] ?? 'ETH'
}

export function explorerName(chainId: string): string {
  return EXPLORER_NAMES[normalizeChainId(chainId)] ?? '區塊瀏覽器'
}

export function tokensForChain(chainId: string): TokenConfig[] {
  const id = normalizeChainId(chainId)
  if (id === SEPOLIA_TESTNET.chainId) return [SEPOLIA_PYUSD, SEPOLIA_USDC]
  if (id === POLYGON_AMOY_TESTNET.chainId) return [AMOY_USDC]
  return []
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function toWeiHex(amount: string): string {
  const trimmed = amount.trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const [whole, frac = ''] = trimmed.split('.')
    const fracPadded = `${frac}${'0'.repeat(18)}`.slice(0, 18)
    const wei = BigInt(whole) * 10n ** 18n + BigInt(fracPadded)
    return `0x${wei.toString(16)}`
  }
  const wei = BigInt(Math.round(Number.parseFloat(trimmed) * 1e18))
  return `0x${wei.toString(16)}`
}

export function formatUnits(value: bigint, decimals: number, places: number): string {
  const base = 10n ** BigInt(decimals)
  const scale = 10n ** BigInt(places)
  const scaled = (value * scale + base / 2n) / base
  const whole = scaled / scale
  const fraction = (scaled % scale).toString().padStart(places, '0')
  return `${whole}.${fraction}`
}

export function balanceOfData(account: string): string {
  const address = account.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  return `0x70a08231${address}`
}

export function hexToBigInt(hex: string): bigint {
  if (!hex || hex === '0x') return 0n
  return BigInt(hex)
}

export const FAUCETS = [
  {
    href: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia/pyusd',
    label: 'Google Sepolia PYUSD 水龍頭',
    note: '專領 PYUSD',
  },
  {
    href: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
    label: 'Google Ethereum Sepolia 水龍頭',
  },
  {
    href: 'https://faucet.circle.com/',
    label: 'Circle USDC 官方水龍頭',
    note: '專領 USDC',
  },
  {
    href: 'https://faucet.polygon.technology/',
    label: 'Polygon 官方水龍頭',
  },
  {
    href: 'https://www.bnbchain.org/en/testnet-faucet',
    label: 'BNB Smart Chain 官方水龍頭',
    note: '專領 tBNB',
  },
] as const

export const EXPLORERS = [
  {
    href: 'https://testnet.bscscan.com/',
    label: 'BSC 測試網瀏覽器',
    note: 'Binance Smart Chain Testnet',
  },
  {
    href: 'https://sepolia.etherscan.io/',
    label: 'Sepolia 測試網瀏覽器',
    note: 'Ethereum Sepolia Testnet',
  },
] as const
