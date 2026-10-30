export type EthereumRequest = {
  method: string
  params?: unknown
}

export type EthereumProvider = {
  request: (args: EthereumRequest) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

type EthereumWindow = Window & {
  ethereum?: EthereumProvider
}

export function ethereumProvider(): EthereumProvider | null {
  const provider = (window as EthereumWindow).ethereum
  return provider ?? null
}
