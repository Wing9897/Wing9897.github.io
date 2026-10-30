export type SolanaPublicKey = {
  toString: () => string
}

export type SignedTransaction = {
  serialize: () => Uint8Array | Promise<Uint8Array>
}

export type PhantomProvider = {
  isPhantom?: boolean
  connect: () => Promise<{ publicKey: SolanaPublicKey }>
  signTransaction: (transaction: unknown) => Promise<SignedTransaction>
}

type PhantomWindow = Window & {
  solana?: PhantomProvider
}

export function phantomProvider(): PhantomProvider | null {
  const provider = (window as PhantomWindow).solana
  if (provider?.isPhantom) return provider
  return null
}
