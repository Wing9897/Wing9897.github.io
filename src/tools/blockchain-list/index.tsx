import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Banner, Button, Field, Select, Table, type TableColumn } from '@/components/ui'
import {
  byPopularity,
  chainLogoSlug,
  chainSearchText,
  chainsData,
  recordLogoSlug,
  rpcKind,
  tokenSearchText,
  tokensData,
  type ChainRecord,
  type TokenRecord,
} from './data'
import './tool.css'

const SORT_OPTIONS = [
  { value: 'default', label: '預設排序' },
  { value: 'popularity', label: '按熱門程度' },
]

function Logo({ slug }: { slug: string }) {
  const letter = slug.trim().charAt(0).toUpperCase() || '·'
  return (
    <span className="bl-logo" aria-hidden>
      {letter}
    </span>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bl-cell">
      <span className="bl-cell-label">{label}</span>
      {children}
    </div>
  )
}

function NameCell({ record }: { record: { name: string; name_zh: string; symbol: string; slug: string; note?: string } }) {
  return (
    <div className="bl-name">
      <Logo slug={recordLogoSlug(record)} />
      <div className="bl-name-text">
        {record.name}
        <span className="bl-symbol"> ({record.symbol})</span>
        {record.name_zh ? <span className="bl-zh">{record.name_zh}</span> : null}
        {record.note ? <span className="bl-note">{record.note}</span> : null}
      </div>
    </div>
  )
}

export default function Tool() {
  const chainsRef = useRef<HTMLElement>(null)
  const tokensRef = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [chainSort, setChainSort] = useState('default')
  const [tokenSort, setTokenSort] = useState('default')
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.toLowerCase()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.tone === 'success' ? 2000 : 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setToast({ tone: 'success', text: '已複製到剪貼簿!' })
    } catch (error) {
      console.error('無法複製: ', error)
      setToast({ tone: 'danger', text: '複製失敗，請手動複製' })
    }
  }

  const chains = useMemo(() => {
    const sorted = chainSort === 'popularity' ? byPopularity(chainsData) : chainsData
    if (!term) return sorted
    return sorted.filter((chain) => chainSearchText(chain).includes(term))
  }, [chainSort, term])

  const tokens = useMemo(() => {
    const sorted = tokenSort === 'popularity' ? byPopularity(tokensData) : tokensData
    if (!term) return sorted
    return sorted.filter((token) => tokenSearchText(token).includes(term))
  }, [tokenSort, term])

  const chainColumns: TableColumn<ChainRecord>[] = [
    {
      key: 'name',
      header: '名稱',
      render: (chain) => (
        <Cell label="名稱">
          <NameCell record={chain} />
        </Cell>
      ),
    },
    {
      key: 'type',
      header: '類型',
      render: (chain) => <Cell label="類型">{chain.type}</Cell>,
    },
    {
      key: 'vm',
      header: '虛擬機',
      render: (chain) => <Cell label="虛擬機">{chain.vm}</Cell>,
    },
    {
      key: 'rpc',
      header: 'RPC / API / Chain ID',
      render: (chain) => (
        <Cell label="RPC / API / Chain ID">
          {chain.rpc || chain.chainId ? (
            <>
              {chain.rpc ? (
                <div className="bl-rpc">
                  <strong>{rpcKind(chain)}:</strong>
                  <code className="bl-code">{chain.rpc}</code>
                  <Button variant="ghost" className="bl-copy" onClick={() => void copyValue(chain.rpc ?? '')}>
                    複製
                  </Button>
                </div>
              ) : null}
              {chain.chainId ? <span className="bl-meta">Chain ID: {chain.chainId}</span> : null}
            </>
          ) : (
            'N/A'
          )}
        </Cell>
      ),
    },
    {
      key: 'explorer',
      header: '區塊瀏覽器',
      render: (chain) => (
        <Cell label="區塊瀏覽器">
          {chain.explorer ? (
            <a href={chain.explorer} target="_blank" rel="noopener noreferrer">
              查看
            </a>
          ) : (
            'N/A'
          )}
        </Cell>
      ),
    },
  ]

  const tokenColumns: TableColumn<TokenRecord>[] = [
    {
      key: 'name',
      header: '名稱',
      render: (token) => (
        <Cell label="名稱">
          <NameCell record={token} />
        </Cell>
      ),
    },
    {
      key: 'track',
      header: '賽道',
      render: (token) => <Cell label="賽道">{token.track}</Cell>,
    },
    {
      key: 'contracts',
      header: '合約地址',
      render: (token) => (
        <Cell label="合約地址">
          {token.contracts && Object.keys(token.contracts).length > 0 ? (
            <div className="bl-contracts">
              {Object.entries(token.contracts).map(([chain, address]) => (
                <div className="bl-contract" key={`${token.slug}-${chain}`}>
                  <Logo slug={chainLogoSlug(chain)} />
                  <strong>{chain}:</strong>
                  <code className="bl-code">{address}</code>
                  <Button variant="ghost" className="bl-copy" onClick={() => void copyValue(address)}>
                    複製
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            'N/A'
          )}
        </Cell>
      ),
    },
  ]

  function clearSearch() {
    setQuery('')
    setTerm('')
  }

  return (
    <div className="bl-tool">
      {toast ? <Banner tone={toast.tone}>{toast.text}</Banner> : null}
      <p className="bl-intro">
        本文檔為每個區塊鏈網絡和應用層代幣提供了獨立的、模塊化的信息卡片。所有信息均已通過 ChainList、官方文檔及區塊鏈瀏覽器交叉驗證 (截至 2025年1月)。
      </p>
      <Field
        label="搜尋"
        type="search"
        placeholder="搜尋名稱、符號、賽道..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="bl-nav">
        <Button variant="ghost" onClick={() => chainsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          區塊鏈網路
        </Button>
        <Button variant="ghost" onClick={() => tokensRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          應用層代幣
        </Button>
        <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          回到頂部
        </Button>
      </div>
      {term ? (
        <Banner tone="info">
          搜尋「{term}」的結果：找到 {chains.length} 個區塊鏈，{tokens.length} 個代幣
          <Button variant="ghost" onClick={clearSearch}>
            清除搜尋
          </Button>
        </Banner>
      ) : null}

      <section className="bl-section" ref={chainsRef} id="chains">
        <h2>第一部分：底層區塊鏈網路</h2>
        <div className="bl-sort">
          <Select label="排序" value={chainSort} options={SORT_OPTIONS} onChange={(event) => setChainSort(event.target.value)} />
        </div>
        <Table label="底層區塊鏈網路" columns={chainColumns} rows={chains} getRowKey={(chain) => chain.slug} />
      </section>

      <section className="bl-section" ref={tokensRef} id="tokens">
        <h2>第二部分：應用層代幣</h2>
        <div className="bl-sort">
          <Select label="排序" value={tokenSort} options={SORT_OPTIONS} onChange={(event) => setTokenSort(event.target.value)} />
        </div>
        <Table label="應用層代幣" columns={tokenColumns} rows={tokens} getRowKey={(token) => token.slug} />
      </section>

      <footer className="bl-foot">
        <div>
          <h2>數據來源</h2>
          <p>ChainList、官方文檔及區塊鏈瀏覽器</p>
        </div>
        <div>
          <h2>最後更新</h2>
          <p>2025年1月</p>
        </div>
        <p className="bl-disclaimer">本工具僅供參考，不構成投資建議。投資有風險，請謹慎決策。</p>
      </footer>
    </div>
  )
}
