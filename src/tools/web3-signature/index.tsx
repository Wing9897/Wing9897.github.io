import { useEffect, useState } from 'react'
import { Banner, Button, TextArea, fieldLayout, labelClass, nativeControlClass } from '@/components/ui'
import { signatureBase58, signatureHex, type SignatureBytes } from './base58'
import { EVM_NETWORKS, NETWORK_GROUPS, findNetwork, type EvmNetwork } from './networks'
import {
  getCoinbaseProvider,
  getMetaMaskProvider,
  getOkxProvider,
  getPhantomProvider,
  getSolflareProvider,
  getTrustProvider,
  publicKeyText,
  type EthereumProvider,
  type PhantomSignProvider,
  type SolanaSignResult,
  type SolflareProvider,
} from './providers'
import './tool.css'

type NoticeTone = 'info' | 'success' | 'danger'

type Notice = {
  tone: NoticeTone
  text: string
}

type WalletInfo = {
  name: string
  address: string
  network?: string
}

type EvmWallet = {
  id: string
  name: string
  label: string
  busyLabel: string
  detect: () => EthereumProvider | null
}

const EVM_WALLETS: EvmWallet[] = [
  { id: 'metamask', name: 'MetaMask', label: '🦊 MetaMask', busyLabel: 'MetaMask', detect: getMetaMaskProvider },
  { id: 'coinbase', name: 'Coinbase Wallet', label: '💰 Coinbase', busyLabel: 'Coinbase Wallet', detect: getCoinbaseProvider },
  { id: 'trust', name: 'Trust Wallet', label: '🔐 Trust Wallet', busyLabel: 'Trust Wallet', detect: getTrustProvider },
  { id: 'okx', name: 'OKX Wallet', label: '🪙 OKX Wallet', busyLabel: 'OKX Wallet', detect: getOkxProvider },
]

const DETECTED = [
  { name: 'MetaMask', detect: () => Boolean(getMetaMaskProvider()) },
  { name: 'Coinbase Wallet', detect: () => Boolean(getCoinbaseProvider()) },
  { name: 'Trust Wallet', detect: () => Boolean(getTrustProvider()) },
  { name: 'OKX Wallet', detect: () => Boolean(getOkxProvider()) },
  { name: 'Phantom', detect: () => Boolean(getPhantomProvider()) },
  { name: 'Solflare', detect: () => Boolean(getSolflareProvider()) },
]

function errorParts(error: unknown): { code?: number; message: string } {
  if (error && typeof error === 'object') {
    const record = error as { code?: unknown; message?: unknown }
    return {
      code: typeof record.code === 'number' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : '未知錯誤',
    }
  }
  return { message: '未知錯誤' }
}

function messageHex(message: string): string {
  const bytes = new TextEncoder().encode(message)
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function normalizeSignature(signature: unknown): SignatureBytes {
  if (typeof signature === 'string' || signature instanceof Uint8Array) return signature
  if (Array.isArray(signature) && signature.every((item) => typeof item === 'number')) return signature
  throw new Error('簽名型別未知')
}

function solanaResultText(title: string, message: string, signed: SolanaSignResult, fallbackKey: string): string {
  if (!signed.signature) throw new Error('簽名返回格式不正確')
  const signature = normalizeSignature(signed.signature)
  const base58 = signatureBase58(signature)
  const hex = signatureHex(signature)
  const pubKey = publicKeyText(signed.publicKey) || fallbackKey
  return `${title} 簽名結果：\n\n訊息：${message}\n\nBase58（用於 OSL）：\n${base58}\n\nHex：\n${hex}\n\n公鑰：\n${pubKey}`
}

function rejected(error: unknown): boolean {
  const { code, message } = errorParts(error)
  return code === 4001 || message.includes('rejected') || message.includes('cancelled')
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (!ok) throw new Error('copy failed')
  }
}

async function switchNetwork(provider: EthereumProvider, network: EvmNetwork) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }],
    })
  } catch (error) {
    if (errorParts(error).code !== 4902) throw error
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: network.chainId,
            chainName: network.name,
            rpcUrls: [network.rpcUrl],
            nativeCurrency: {
              name: network.symbol,
              symbol: network.symbol,
              decimals: 18,
            },
            blockExplorerUrls: [network.blockExplorer],
          },
        ],
      })
    } catch (addError) {
      throw new Error(`添加網絡失敗：${errorParts(addError).message}`)
    }
  }
}

export default function Tool() {
  const [networkId, setNetworkId] = useState(EVM_NETWORKS[0]?.id ?? 'ethereum-mainnet')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState('等待簽名...')
  const [resultReady, setResultReady] = useState(false)
  const [canCopy, setCanCopy] = useState(false)
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detected, setDetected] = useState<boolean[]>(() => DETECTED.map(() => false))

  useEffect(() => {
    setDetected(DETECTED.map((item) => item.detect()))
    const provider = getMetaMaskProvider()
    if (!provider?.on) return

    const onAccounts = (value: unknown) => {
      const accounts = Array.isArray(value) ? value : []
      if (accounts.length === 0) {
        setNotice({ tone: 'info', text: 'MetaMask 帳戶已斷開連接' })
        setWalletInfo(null)
      }
    }
    const onChain = () => {
      setNotice({ tone: 'info', text: '網絡已切換，請重新簽名' })
    }
    provider.on('accountsChanged', onAccounts)
    provider.on('chainChanged', onChain)
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts)
      provider.removeListener?.('chainChanged', onChain)
    }
  }, [])

  function showNotice(tone: NoticeTone, text: string) {
    setNotice({ tone, text })
  }

  async function signWithEvm(wallet: EvmWallet) {
    setBusyId(wallet.id)
    setNotice(null)
    try {
      const provider = wallet.detect()
      if (!provider) {
        showNotice('danger', `請先安裝 ${wallet.name} 擴充功能！`)
        return
      }
      const text = message.trim()
      if (!text) {
        showNotice('danger', '請先輸入要簽名的訊息！')
        return
      }
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
      if (!accounts || accounts.length === 0) throw new Error('未選擇帳戶')
      const from = accounts[0] ?? ''
      const network = findNetwork(networkId)
      if (network) await switchNetwork(provider, network)
      setWalletInfo({
        name: wallet.name,
        address: from,
        network: network?.name ?? '未知',
      })
      const signature = String(
        await provider.request({
          method: 'personal_sign',
          params: [text, from],
        }),
      )
      const payload = {
        msg: messageHex(text),
        version: '1.0',
        signer: 'wing9897',
        signature,
        network: network?.name ?? '未知',
        chainId: network?.chainIdInt ?? null,
      }
      setResult(`${wallet.name} 簽名結果：\n\n${JSON.stringify(payload, null, 2)}`)
      setResultReady(true)
      setCanCopy(true)
      showNotice('success', '簽名成功！')
    } catch (error) {
      const text = errorParts(error).code === 4001 ? '簽名失敗：用戶拒絕了簽名請求' : `簽名失敗：${errorParts(error).message}`
      setResult(text)
      setResultReady(true)
      setCanCopy(false)
      showNotice('danger', text)
    } finally {
      setBusyId(null)
    }
  }

  async function connectSolana(provider: { isConnected?: boolean; connect: () => Promise<unknown> }) {
    if (!provider.isConnected) await provider.connect()
  }

  async function signWithPhantom() {
    setBusyId('phantom')
    setNotice(null)
    try {
      const provider: PhantomSignProvider | null = getPhantomProvider()
      if (!provider) {
        showNotice('danger', '請先安裝 Phantom 擴充功能！')
        return
      }
      const text = message.trim()
      if (!text) {
        showNotice('danger', '請先輸入要簽名的訊息！')
        return
      }
      await connectSolana(provider)
      const key = publicKeyText(provider.publicKey)
      setWalletInfo({ name: 'Phantom', address: key })
      const signed = await provider.request({
        method: 'signMessage',
        params: { message: new TextEncoder().encode(text), display: 'utf8' },
      })
      setResult(solanaResultText('Phantom', text, signed, key))
      setResultReady(true)
      setCanCopy(true)
      showNotice('success', '簽名成功！')
    } catch (error) {
      const text = rejected(error) ? '簽名失敗：用戶拒絕了簽名請求' : `簽名失敗：${errorParts(error).message}`
      setResult(text)
      setResultReady(true)
      setCanCopy(false)
      showNotice('danger', text)
    } finally {
      setBusyId(null)
    }
  }

  async function signWithSolflare() {
    setBusyId('solflare')
    setNotice(null)
    try {
      const provider: SolflareProvider | null = getSolflareProvider()
      if (!provider) {
        showNotice('danger', '請先安裝 Solflare 擴充功能！')
        return
      }
      const text = message.trim()
      if (!text) {
        showNotice('danger', '請先輸入要簽名的訊息！')
        return
      }
      await connectSolana(provider)
      const key = publicKeyText(provider.publicKey)
      setWalletInfo({ name: 'Solflare', address: key })
      const signed = await provider.signMessage(new TextEncoder().encode(text), 'utf8')
      setResult(solanaResultText('Solflare', text, signed, key))
      setResultReady(true)
      setCanCopy(true)
      showNotice('success', '簽名成功！')
    } catch (error) {
      const text = rejected(error) ? '簽名失敗：用戶拒絕了簽名請求' : `簽名失敗：${errorParts(error).message}`
      setResult(text)
      setResultReady(true)
      setCanCopy(false)
      showNotice('danger', text)
    } finally {
      setBusyId(null)
    }
  }

  async function copyResult() {
    try {
      await copyText(result)
      showNotice('success', '已複製到剪貼簿！')
      window.setTimeout(() => setNotice(null), 2000)
    } catch {
      showNotice('danger', '複製失敗，請手動複製')
    }
  }

  return (
    <div className="sig-tool">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <div className="sig-layout">
        <section className="sig-card">
          <h2>錢包</h2>
          <label className={fieldLayout}>
            <span className={labelClass}>選擇網絡（EVM 錢包）</span>
            <select
              id="network"
              className={nativeControlClass}
              value={networkId}
              onChange={(event) => setNetworkId(event.target.value)}
            >
              {NETWORK_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {EVM_NETWORKS.filter((network) => network.group === group).map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="sig-actions">
            {EVM_WALLETS.map((wallet) => (
              <Button key={wallet.id} disabled={busyId !== null} onClick={() => void signWithEvm(wallet)}>
                {busyId === wallet.id ? `請在 ${wallet.busyLabel} 確認簽名...` : wallet.label}
              </Button>
            ))}
            <Button disabled={busyId !== null} onClick={() => void signWithPhantom()}>
              {busyId === 'phantom' ? '請在 Phantom 確認簽名...' : '👻 Phantom'}
            </Button>
            <Button disabled={busyId !== null} onClick={() => void signWithSolflare()}>
              {busyId === 'solflare' ? '請在 Solflare 確認簽名...' : '☀️ Solflare'}
            </Button>
          </div>
          <ul className="sig-detect">
            {DETECTED.map((item, index) => (
              <li key={item.name} className={detected[index] ? 'sig-ok' : 'sig-bad'}>
                {detected[index] ? '✅' : '❌'} {item.name} {detected[index] ? '已檢測到' : '未檢測到'}
              </li>
            ))}
          </ul>
        </section>

        <section className="sig-card">
          <TextArea
            label="輸入待簽名的訊息"
            rows={6}
            placeholder="請在此輸入要簽名的內容..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <h2>簽名結果</h2>
          {walletInfo ? (
            <dl className="sig-wallet">
              <div>
                <dt>錢包</dt>
                <dd>{walletInfo.name}</dd>
              </div>
              <div>
                <dt>地址</dt>
                <dd>{walletInfo.address}</dd>
              </div>
              {walletInfo.network ? (
                <div>
                  <dt>網絡</dt>
                  <dd>{walletInfo.network}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <pre className={resultReady ? 'sig-result' : 'sig-result is-empty'}>{result}</pre>
          {canCopy ? (
            <div className="sig-actions">
              <Button variant="ghost" onClick={() => void copyResult()}>
                複製簽名結果
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
