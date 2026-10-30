import { useEffect, useRef, useState } from 'react'
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, clusterApiUrl } from '@solana/web3.js'
import { Banner, Button, Field } from '@/components/ui'
import { phantomProvider, type PhantomProvider } from './providers'
import './tool.css'

type ClusterName = 'devnet' | 'testnet' | 'mainnet-beta'
type NoticeTone = 'info' | 'success' | 'danger'

type Notice = {
  tone: NoticeTone
  text: string
  href?: string
  linkLabel?: string
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '未知錯誤'
}

function formatPublicKey(key: string): string {
  if (key.length <= 12) return key
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

function lamportsToSol(value: bigint | number): string {
  const lamports = typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
  const scale = 1_000_000n
  const sol = BigInt(LAMPORTS_PER_SOL)
  const negative = lamports < 0n
  const abs = negative ? -lamports : lamports
  const scaled = (abs * scale + sol / 2n) / sol
  const whole = scaled / scale
  const fraction = (scaled % scale).toString().padStart(6, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

function AccountQr({ address }: { address: string }) {
  const [failed, setFailed] = useState(false)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}`
  return (
    <div className="ph-qr">
      <h3>📱 公鑰 QR Code</h3>
      {failed ? null : <img src={src} alt="公鑰 QR Code" width={150} height={150} onError={() => setFailed(true)} />}
      <p className="ph-hash">{address}</p>
    </div>
  )
}

export default function Tool() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState('--')
  const [networkLabel, setNetworkLabel] = useState('--')
  const [network, setNetwork] = useState<Exclude<ClusterName, 'mainnet-beta'>>('devnet')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const networkRef = useRef(network)
  const publicKeyRef = useRef<string | null>(null)
  const providerRef = useRef<PhantomProvider | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const mounted = useRef(true)

  networkRef.current = network
  publicKeyRef.current = publicKey

  function showNotice(tone: NoticeTone, text: string, link?: { href: string; linkLabel: string }) {
    setNotice({ tone, text, href: link?.href, linkLabel: link?.linkLabel })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => {
      if (mounted.current) setNotice(null)
    }, 8000)
  }

  async function updateBalance(key: string, cluster: Exclude<ClusterName, 'mainnet-beta'>) {
    try {
      const connection = new Connection(clusterApiUrl(cluster))
      const lamports = await connection.getBalance(new PublicKey(key))
      if (!mounted.current) return
      setBalance(lamportsToSol(lamports))
      setNetworkLabel(cluster)
    } catch (error) {
      console.error('讀取餘額失敗:', error)
      if (!mounted.current) return
      setBalance('--')
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    }
  }, [])

  async function connectPhantom() {
    const nextProvider = phantomProvider()
    if (!nextProvider) {
      showNotice('danger', '請先安裝 Phantom 錢包擴展！')
      return
    }
    setBusy(true)
    try {
      const response = await nextProvider.connect()
      const key = response.publicKey.toString()
      providerRef.current = nextProvider
      setPublicKey(key)
      showNotice('success', 'Phantom 連接成功！')
      await updateBalance(key, networkRef.current)
    } catch (error) {
      showNotice('danger', `連接失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function refreshAccount() {
    const key = publicKeyRef.current
    if (!providerRef.current || !key) return
    await updateBalance(key, networkRef.current)
    showNotice('info', '已刷新帳戶資訊')
  }

  function switchNetwork(next: ClusterName) {
    if (next === 'mainnet-beta') {
      showNotice('info', '主網僅供顯示，請使用 Devnet 或 Testnet')
      return
    }
    setNetwork(next)
    setNetworkLabel(next)
    const key = publicKeyRef.current
    if (key) void updateBalance(key, next)
    showNotice('success', `已切換到 ${next}`)
  }

  async function sendSol() {
    const toAddress = recipient.trim()
    const value = Number.parseFloat(amount)
    if (!toAddress || Number.isNaN(value) || value <= 0) {
      showNotice('danger', '請輸入正確的接收地址與金額！')
      return
    }
    const key = publicKeyRef.current
    const wallet = providerRef.current
    if (!key || !wallet) {
      showNotice('danger', '請先連接 Phantom 錢包！')
      return
    }
    setBusy(true)
    try {
      const cluster = networkRef.current
      const connection = new Connection(clusterApiUrl(cluster))
      const fromPubkey = new PublicKey(key)
      const toPubkey = new PublicKey(toAddress)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.round(value * LAMPORTS_PER_SOL),
        }),
      )
      transaction.feePayer = fromPubkey
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      const signed = await wallet.signTransaction(transaction)
      const raw = await Promise.resolve(signed.serialize())
      const txid = await connection.sendRawTransaction(raw)
      showNotice('success', `交易已發送！\n交易哈希: ${txid}`, {
        href: `https://explorer.solana.com/tx/${txid}?cluster=${cluster}`,
        linkLabel: '查看區塊鏈瀏覽器',
      })
      window.setTimeout(() => {
        const current = publicKeyRef.current
        if (!current || !mounted.current) return
        void updateBalance(current, networkRef.current)
      }, 3000)
    } catch (error) {
      showNotice('danger', `交易失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="ph-tool">
      {notice ? (
        <Banner tone={notice.tone}>
          <span className="ph-notice">
            {notice.text}
            {notice.href ? (
              <>
                {'\n'}
                <a href={notice.href} target="_blank" rel="noopener noreferrer">
                  {notice.linkLabel}
                </a>
              </>
            ) : null}
          </span>
        </Banner>
      ) : null}

      <div className="ph-grid">
        <section className="ph-card">
          <h2>📋 使用說明</h2>
          <ol className="ph-list">
            <li>安裝 Phantom 錢包擴展，並建立/導入錢包</li>
            <li>點擊「連接 Phantom」按鈕</li>
            <li>切換到 Devnet 或 Testnet，並使用水龍頭領取 SOL</li>
            <li>可發送 SOL 測試交易，並於區塊鏈瀏覽器查詢</li>
          </ol>
        </section>

        <section className="ph-card">
          <h2>💸 發送 SOL 測試交易</h2>
          <Field
            label="接收地址"
            placeholder="Solana 公鑰 (Base58)"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Field
            label="金額 (SOL)"
            type="number"
            placeholder="0.01"
            min="0.000000001"
            step="0.000000001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <div className="ph-actions">
            <Button disabled={!publicKey || busy} onClick={() => void sendSol()}>
              🚀 發送 SOL
            </Button>
          </div>
        </section>

        <section className="ph-card">
          <h2>🔗 連接狀態</h2>
          <dl className="ph-status">
            <div>
              <dt>連接狀態</dt>
              <dd className={publicKey ? 'ph-ok' : undefined}>{publicKey ? '✅ 已連接' : '未連接'}</dd>
            </div>
            <div>
              <dt>公鑰</dt>
              <dd className="ph-hash" title={publicKey ?? undefined}>
                {publicKey ? formatPublicKey(publicKey) : '--'}
              </dd>
            </div>
            <div>
              <dt>餘額 (SOL)</dt>
              <dd>{balance}</dd>
            </div>
            <div>
              <dt>網絡</dt>
              <dd>{networkLabel}</dd>
            </div>
          </dl>
          <div className="ph-actions">
            <Button disabled={busy} onClick={() => void connectPhantom()}>
              🔌 連接錢包
            </Button>
            <Button variant="ghost" disabled={!publicKey || busy} onClick={() => void refreshAccount()}>
              🔄 刷新資訊
            </Button>
          </div>
          {publicKey ? <AccountQr key={publicKey} address={publicKey} /> : null}
        </section>

        <section className="ph-card">
          <h2>🌐 網絡切換</h2>
          <div className="ph-actions">
            <Button variant="ghost" onClick={() => switchNetwork('devnet')}>
              切換 Devnet
            </Button>
            <Button variant="ghost" onClick={() => switchNetwork('testnet')}>
              切換 Testnet
            </Button>
          </div>
          <p className="ph-muted">目前僅支援 Devnet/Testnet 測試網功能</p>
        </section>

        <section className="ph-card">
          <h2>🆓 Solana 官方水龍頭</h2>
          <ul className="ph-links">
            <li>
              <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer">
                Solana Devnet/Testnet 官方水龍頭
              </a>
            </li>
          </ul>
          <p className="ph-muted">每 8 小時最多 2 次，請用 Phantom 公鑰領取</p>
        </section>

        <section className="ph-card">
          <h2>🔍 區塊鏈瀏覽器</h2>
          <ul className="ph-links">
            <li>
              <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer">
                Solana Devnet Explorer
              </a>
            </li>
            <li>
              <a href="https://explorer.solana.com/?cluster=testnet" target="_blank" rel="noopener noreferrer">
                Solana Testnet Explorer
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
