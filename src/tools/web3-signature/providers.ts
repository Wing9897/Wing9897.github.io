export type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
  isCoinbaseWallet?: boolean
  isTrustWallet?: boolean
  providers?: EthereumProvider[]
}

export type SolanaPublicKeyLike = { toString: () => string } | string

export type SolanaSignResult = {
  signature?: string | Uint8Array | number[]
  publicKey?: SolanaPublicKeyLike
}

export type PhantomSignProvider = {
  isPhantom?: boolean
  isConnected?: boolean
  connect: () => Promise<unknown>
  request: (args: { method: string; params?: unknown }) => Promise<SolanaSignResult>
  publicKey?: SolanaPublicKeyLike | null
}

export type SolflareProvider = {
  isConnected?: boolean
  connect: () => Promise<unknown>
  signMessage: (message: Uint8Array, display?: string) => Promise<SolanaSignResult>
  publicKey?: SolanaPublicKeyLike | null
}

type WalletWindow = Window & {
  ethereum?: EthereumProvider
  okx?: { wallet?: { ethereum?: EthereumProvider } }
  okexchain?: EthereumProvider
  solana?: PhantomSignProvider
  phantom?: { solana?: PhantomSignProvider }
  solflare?: SolflareProvider
}

function walletWindow(): WalletWindow {
  return window as WalletWindow
}

export function getMetaMaskProvider(): EthereumProvider | null {
  const ethereum = walletWindow().ethereum
  if (!ethereum) return null
  if (ethereum.isMetaMask) return ethereum
  const nested = ethereum.providers?.find((provider) => provider?.isMetaMask)
  if (nested) return nested
  return ethereum
}

export function getCoinbaseProvider(): EthereumProvider | null {
  const ethereum = walletWindow().ethereum
  if (!ethereum) return null
  if (ethereum.isCoinbaseWallet) return ethereum
  return ethereum.providers?.find((provider) => provider?.isCoinbaseWallet) ?? null
}

export function getTrustProvider(): EthereumProvider | null {
  const ethereum = walletWindow().ethereum
  if (!ethereum) return null
  if (ethereum.isTrustWallet) return ethereum
  return ethereum.providers?.find((provider) => provider?.isTrustWallet) ?? null
}

export function getOkxProvider(): EthereumProvider | null {
  const root = walletWindow()
  if (root.okx?.wallet?.ethereum) return root.okx.wallet.ethereum
  if (root.okexchain) return root.okexchain
  return null
}

export function getPhantomProvider(): PhantomSignProvider | null {
  const root = walletWindow()
  if (root.solana?.isPhantom) return root.solana
  if (root.phantom?.solana?.isPhantom) return root.phantom.solana
  return null
}

export function getSolflareProvider(): SolflareProvider | null {
  const solflare = walletWindow().solflare
  if (solflare) return solflare
  return null
}

export function publicKeyText(value: SolanaPublicKeyLike | null | undefined): string {
  if (!value) return ''
  return typeof value === 'string' ? value : value.toString()
}
