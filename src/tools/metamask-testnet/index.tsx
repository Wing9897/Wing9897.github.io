import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Field, Select } from '@/components/ui'
import {
  AMOY_USDC,
  BSC_TESTNET,
  EXPLORERS,
  FAUCETS,
  POLYGON_AMOY_TESTNET,
  SEPOLIA_PYUSD,
  SEPOLIA_TESTNET,
  SEPOLIA_USDC,
  balanceOfData,
  explorerName,
  formatUnits,
  hexToBigInt,
  isAddress,
  networkName,
  networkSymbol,
  shortAddress,
  tokensForChain,
  toWeiHex,
  type ChainConfig,
  type TokenConfig,
} from './networks'
import { ethereumProvider, type EthereumProvider } from './providers'
import './tool.css'

type NoticeTone = 'info' | 'success' | 'danger'

type Notice = {
  tone: NoticeTone
  text: string
}

type TokenBalance = Record<string, string>

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '未知錯誤'
}

function errorCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'number') {
    return error.code
  }
  return undefined
}

function asAccounts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function AccountQr({ address }: { address: string }) {
  const [step, setStep] = useState(0)
  const sources = [
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}`,
    `https://chart.googleapis.com/chart?cht=qr&chs=150x150&chl=${encodeURIComponent(address)}`,
  ]
  const src = sources[step]

  return (
    <div className="mm-qr">
      <h3>📱 當前帳戶 QR Code</h3>
      {src ? (
        <img src={src} alt="當前帳戶 QR Code" width={150} height={150} onError={() => setStep((current) => current + 1)} />
      ) : null}
      <p className="mm-hash">{address}</p>
    </div>
  )
}

export default function Tool() {
  const [accounts, setAccounts] = useState<string[]>([])
  const [currentAccount, setCurrentAccount] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState('未連接')
  const [networkLabel, setNetworkLabel] = useState('--')
  const [chainLabel, setChainLabel] = useState('--')
  const [balanceLabel, setBalanceLabel] = useState('--')
  const [chainId, setChainId] = useState('')
  const [tokenBalances, setTokenBalances] = useState<TokenBalance>({})
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const accountRef = useRef<string | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const mounted = useRef(true)

  accountRef.current = currentAccount
  const ready = Boolean(currentAccount)

  function showNotice(tone: NoticeTone, text: string) {
    setNotice({ tone, text })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => {
      if (mounted.current) setNotice(null)
    }, 8000)
  }

  function clearWalletView() {
    setAccounts([])
    setCurrentAccount(null)
    setConnectionLabel('❌ 未連接')
    setNetworkLabel('--')
    setChainLabel('--')
    setBalanceLabel('--')
    setChainId('')
    setTokenBalances({})
  }

  async function readTokenBalances(provider: EthereumProvider, account: string, id: string) {
    const tokens = tokensForChain(id)
    if (tokens.length === 0) {
      setTokenBalances({})
      return
    }
    const entries = await Promise.all(
      tokens.map(async (token) => {
        try {
          const hex = await provider.request({
            method: 'eth_call',
            params: [{ to: token.address, data: balanceOfData(account) }, 'latest'],
          })
          const value = formatUnits(hexToBigInt(String(hex)), token.decimals, token.decimals)
          return [token.id, `${value} ${token.symbol}`] as const
        } catch (error) {
          console.error('讀取代幣餘額失敗:', error)
          return [token.id, '無法讀取'] as const
        }
      }),
    )
    if (!mounted.current) return
    setTokenBalances(Object.fromEntries(entries))
  }

  async function refreshAccount(account: string) {
    const provider = ethereumProvider()
    if (!provider) return
    const rawChainId = String(await provider.request({ method: 'eth_chainId' }))
    const id = rawChainId.toLowerCase()
    if (!mounted.current) return
    setNetworkLabel(networkName(id))
    setChainLabel(`${Number.parseInt(rawChainId, 16)} (${rawChainId})`)
    setChainId(id)
    const hexBalance = String(
      await provider.request({
        method: 'eth_getBalance',
        params: [account, 'latest'],
      }),
    )
    if (!mounted.current) return
    setBalanceLabel(`${formatUnits(hexToBigInt(hexBalance), 18, 6)} ${networkSymbol(id)}`)
    await readTokenBalances(provider, account, id)
  }

  function applyAccounts(nextAccounts: string[], nextAccount: string | null) {
    setAccounts(nextAccounts)
    setCurrentAccount(nextAccount)
    if (!nextAccount) {
      clearWalletView()
      return
    }
    setConnectionLabel('✅ 已連接')
    void refreshAccount(nextAccount).catch((error) => {
      console.error('獲取帳戶信息失敗:', error)
    })
  }

  useEffect(() => {
    mounted.current = true
    const provider = ethereumProvider()

    void (async () => {
      if (!provider) return
      try {
        const existing = asAccounts(await provider.request({ method: 'eth_accounts' }))
        if (!mounted.current || existing.length === 0) return
        applyAccounts(existing, existing[0] ?? null)
      } catch (error) {
        console.error('檢查連接狀態失敗:', error)
      }
    })()

    const onAccounts = (value: unknown) => {
      const next = asAccounts(value)
      if (next.length === 0) {
        clearWalletView()
        showNotice('danger', 'MetaMask 已斷開連接')
        return
      }
      const current = accountRef.current
      const selected = current && next.includes(current) ? current : (next[0] ?? null)
      applyAccounts(next, selected)
      showNotice('info', '帳戶已更新')
    }

    const onChain = (nextChainId: unknown) => {
      const account = accountRef.current
      if (account) {
        void refreshAccount(account).catch((error) => {
          console.error('獲取帳戶信息失敗:', error)
        })
      }
      const label = typeof nextChainId === 'string' ? networkName(nextChainId) : '未知網絡'
      showNotice('info', `已切換到 ${label} 網絡`)
    }

    provider?.on?.('accountsChanged', onAccounts)
    provider?.on?.('chainChanged', onChain)

    return () => {
      mounted.current = false
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
      provider?.removeListener?.('accountsChanged', onAccounts)
      provider?.removeListener?.('chainChanged', onChain)
    }
  }, [])

  async function connectMetaMask() {
    const provider = ethereumProvider()
    if (!provider) {
      showNotice('danger', '請先安裝 MetaMask 瀏覽器擴展！')
      return
    }
    setBusy(true)
    try {
      const next = asAccounts(await provider.request({ method: 'eth_requestAccounts' }))
      if (next.length === 0) return
      applyAccounts(next, next[0] ?? null)
      showNotice('success', 'MetaMask 連接成功！')
    } catch (error) {
      console.error('連接失敗:', error)
      showNotice('danger', `連接失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function refreshAccounts() {
    const provider = ethereumProvider()
    if (!provider) {
      showNotice('danger', '請先安裝 MetaMask 瀏覽器擴展！')
      return
    }
    setBusy(true)
    try {
      const next = asAccounts(await provider.request({ method: 'eth_accounts' }))
      if (next.length === 0) {
        clearWalletView()
        showNotice('danger', '未找到已連接的帳戶，請重新連接MetaMask')
        return
      }
      const current = accountRef.current
      const selected = current && next.includes(current) ? current : (next[0] ?? null)
      applyAccounts(next, selected)
      showNotice('success', `已刷新帳戶列表，共找到 ${next.length} 個帳戶`)
    } catch (error) {
      console.error('刷新帳戶失敗:', error)
      showNotice('danger', `刷新帳戶失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function switchAccount(value: string) {
    if (!value) {
      showNotice('danger', '請選擇一個帳戶！')
      return
    }
    if (value === currentAccount) {
      showNotice('info', '您已經在使用此帳戶！')
      return
    }
    setCurrentAccount(value)
    setConnectionLabel('✅ 已連接')
    void refreshAccount(value).catch((error) => {
      console.error('切換帳戶失敗:', error)
      showNotice('danger', `切換帳戶失敗: ${errorText(error)}`)
    })
    showNotice('success', `已切換到帳戶：${shortAddress(value)}`)
  }

  async function addNetwork(config: ChainConfig, label: string) {
    const provider = ethereumProvider()
    if (!provider) {
      showNotice('danger', '請先安裝 MetaMask 瀏覽器擴展！')
      return
    }
    setBusy(true)
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainId }],
      })
      showNotice('success', `已切換到 ${label}！`)
    } catch (error) {
      if (errorCode(error) === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [config],
          })
          showNotice('success', `${label} 添加成功！`)
        } catch (addError) {
          console.error('添加網絡失敗:', addError)
          showNotice('danger', `添加網絡失敗: ${errorText(addError)}`)
        }
      } else {
        console.error('切換網絡失敗:', error)
        showNotice('danger', `切換網絡失敗: ${errorText(error)}`)
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
    window.setTimeout(() => {
      const account = accountRef.current
      if (!account || !mounted.current) return
      void refreshAccount(account)
    }, 1000)
  }

  async function watchToken(token: TokenConfig, expectedChainId: string, chainMessage: string, success: string) {
    const provider = ethereumProvider()
    if (!provider) {
      showNotice('danger', '請先安裝 MetaMask 瀏覽器擴展！')
      return
    }
    setBusy(true)
    try {
      let rawChainId = ''
      try {
        rawChainId = String(await provider.request({ method: 'eth_chainId' }))
      } catch {
        showNotice('danger', '無法獲取當前網絡信息')
        return
      }
      if (rawChainId.toLowerCase() !== expectedChainId) {
        showNotice('danger', chainMessage)
        return
      }
      await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            name: token.name,
          },
        },
      })
      showNotice('success', success)
      if (currentAccount) await refreshAccount(currentAccount)
    } catch (error) {
      console.error('添加代幣失敗:', error)
      showNotice('danger', `添加代幣失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function sendTransaction() {
    if (!recipient || !amount) {
      showNotice('danger', '請填寫接收地址和金額！')
      return
    }
    if (!isAddress(recipient)) {
      showNotice('danger', '接收地址格式不正確！')
      return
    }
    if (Number.isNaN(Number(amount)) || Number.parseFloat(amount) <= 0) {
      showNotice('danger', '金額必須是正數！')
      return
    }
    const provider = ethereumProvider()
    if (!provider || !currentAccount) {
      showNotice('danger', '請先安裝 MetaMask 瀏覽器擴展！')
      return
    }
    setBusy(true)
    try {
      const txHash = String(
        await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: recipient,
              from: currentAccount,
              value: toWeiHex(amount),
              gas: '0x5208',
            },
          ],
        }),
      )
      const rawChainId = String(await provider.request({ method: 'eth_chainId' }))
      showNotice(
        'success',
        `交易已發送！\n交易哈希: ${txHash}\n可在 ${explorerName(rawChainId)} 查看交易狀態。`,
      )
      window.setTimeout(() => {
        const account = accountRef.current
        if (!account || !mounted.current) return
        void refreshAccount(account)
      }, 3000)
    } catch (error) {
      console.error('交易失敗:', error)
      showNotice('danger', `交易失敗: ${errorText(error)}`)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const visibleTokens = tokensForChain(chainId)

  return (
    <div className="mm-tool">
      {notice ? (
        <Banner tone={notice.tone}>
          <span className="mm-notice">{notice.text}</span>
        </Banner>
      ) : null}

      <section className="mm-card">
        <h2>📋 使用說明</h2>
        <ol className="mm-list">
          <li>確保安裝了 MetaMask 瀏覽器擴展</li>
          <li>點擊「連接 MetaMask」按鈕</li>
          <li>
            <strong>新手推薦：先使用測試網獲取免費代幣</strong>
          </li>
          <li>添加相應的網絡配置</li>
          <li>輸入接收地址和金額，執行測試交易</li>
        </ol>
        <p className="mm-muted">
          更多 Chain ID 資訊：
          <a href="https://chainlist.org/" target="_blank" rel="noopener noreferrer">
            Chainlist.org
          </a>
          －完整的 EVM 網絡清單，幫助您連接到正確的 Chain ID 和 Network ID
        </p>
      </section>

      <div className="mm-grid">
        <section className="mm-card">
          <h2>🔗 連接狀態</h2>
          <dl className="mm-status">
            <div>
              <dt>連接狀態</dt>
              <dd className={ready ? 'mm-ok' : connectionLabel.startsWith('❌') ? 'mm-bad' : undefined}>{connectionLabel}</dd>
            </div>
            <div>
              <dt>網絡</dt>
              <dd>{networkLabel}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd className="mm-hash">{chainLabel}</dd>
            </div>
            <div>
              <dt>餘額</dt>
              <dd>{balanceLabel}</dd>
            </div>
          </dl>
          <Select
            label="當前帳戶"
            value={currentAccount ?? ''}
            disabled={!ready || busy}
            options={
              accounts.length > 0
                ? accounts.map((account) => ({ value: account, label: shortAddress(account) }))
                : [{ value: '', label: '請先連接錢包' }]
            }
            onChange={(event) => switchAccount(event.target.value)}
          />
          <div className="mm-actions">
            <Button onClick={() => void connectMetaMask()} disabled={busy}>
              🔌 連接 MetaMask
            </Button>
            <Button variant="ghost" onClick={() => void refreshAccounts()} disabled={!ready || busy}>
              🔄 刷新帳戶
            </Button>
          </div>
          {currentAccount ? <AccountQr key={currentAccount} address={currentAccount} /> : null}
        </section>

        <section className="mm-card">
          <h2>🌐 網絡與貨幣管理</h2>
          <p className="mm-muted">選擇並切換到您需要的測試網絡</p>
          <div className="mm-actions">
            <Button variant="ghost" disabled={!ready || busy} onClick={() => void addNetwork(SEPOLIA_TESTNET, 'Ethereum Sepolia 測試網')}>
              ⚡ 添加及切換 Ethereum Sepolia (官方)
            </Button>
            <Button
              variant="ghost"
              disabled={!ready || busy}
              onClick={() => void addNetwork(POLYGON_AMOY_TESTNET, 'Polygon Amoy 測試網')}
            >
              🔷 添加及切換 Polygon Amoy (官方)
            </Button>
            <Button variant="ghost" disabled={!ready || busy} onClick={() => void addNetwork(BSC_TESTNET, 'BNB Smart Chain Testnet')}>
              🟡 添加及切換 BNB Smart Chain Testnet (官方)
            </Button>
          </div>
          <div className="mm-sub">
            <h3>🪙 應用代幣管理</h3>
            <p className="mm-muted">添加和管理測試代幣</p>
            <div className="mm-actions">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void watchToken(SEPOLIA_PYUSD, SEPOLIA_TESTNET.chainId, '請先切換到 Ethereum Sepolia 測試網！', '已請求 MetaMask 添加 Ethereum Sepolia PYUSD 代幣！')
                }
              >
                🪙 添加 Sepolia PYUSD (Paxos)
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void watchToken(SEPOLIA_USDC, SEPOLIA_TESTNET.chainId, '請先切換到 Ethereum Sepolia 測試網！', '已請求 MetaMask 添加 Ethereum Sepolia USDC 代幣！')
                }
              >
                💰 添加 Sepolia USDC (Circle)
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void watchToken(AMOY_USDC, POLYGON_AMOY_TESTNET.chainId, '請先切換到 Polygon Amoy 測試網！', '已請求 MetaMask 添加 Polygon Amoy USDC 代幣！')
                }
              >
                💰 添加 Amoy USDC (Circle)
              </Button>
            </div>
            {visibleTokens.map((token) => (
              <div className="mm-token" key={token.id}>
                <p className="mm-hash">
                  <strong>代幣地址：</strong>
                  {token.address}
                </p>
                <p className="mm-muted">
                  <strong>代幣名稱：</strong> {token.name} ({token.symbol})
                  <br />
                  <strong>網絡：</strong> {token.network}
                  <br />
                  <strong>代幣標準：</strong> ERC-20
                  <br />
                  <strong>小數位數：</strong> {token.decimals}
                  <br />
                  <strong>餘額：</strong> {tokenBalances[token.id] ?? '--'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mm-card">
          <h2>🆓 免費測試代幣</h2>
          <p className="mm-muted">從官方水龍頭獲取免費測試代幣</p>
          <ul className="mm-links">
            {FAUCETS.map((faucet) => (
              <li key={faucet.href}>
                <a href={faucet.href} target="_blank" rel="noopener noreferrer">
                  {faucet.label}
                  {'note' in faucet ? `（${faucet.note}）` : ''}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mm-card">
          <h2>🔍 區塊鏈瀏覽器</h2>
          <p className="mm-muted">查看交易記錄和區塊鏈資訊</p>
          <ul className="mm-links">
            {EXPLORERS.map((explorer) => (
              <li key={explorer.href}>
                <a href={explorer.href} target="_blank" rel="noopener noreferrer">
                  {explorer.label}（{explorer.note}）
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mm-card mm-span">
          <h2>💸 測試交易</h2>
          <Field label="接收地址" placeholder="0x..." value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" spellCheck={false} />
          <Field label="金額" placeholder="0.001" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" />
          <div className="mm-actions">
            <Button disabled={!ready || busy} onClick={() => void sendTransaction()}>
              🚀 發送測試交易
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
