import { useState } from 'react'
import { Banner, Button, Field, Tabs } from '@/components/ui'
import './tool.css'
import { analyzeIp, detectMyIp, type Analysis, type ApiKeys, type Row, type SourcePill } from './analyze'

const EMPTY_KEYS: ApiKeys = {
  proxycheck: '',
  abuseipdb: '',
  ipqs: '',
  vpnapi: '',
  shodan: '',
  greynoise: '',
  ipinfo: '',
  ipgeo: '',
}

const KEY_FIELDS: { id: keyof ApiKeys; label: string; placeholder: string }[] = [
  { id: 'proxycheck', label: 'PROXYCHECK.IO', placeholder: '免費 Key 或留空基礎版' },
  { id: 'abuseipdb', label: 'ABUSEIPDB', placeholder: '需 CORS Proxy 或後端' },
  { id: 'ipqs', label: 'IPQUALITYSCORE', placeholder: '免費 5000次/月' },
  { id: 'vpnapi', label: 'VPNAPI.IO', placeholder: '免費 1000次/天' },
  { id: 'shodan', label: 'SHODAN', placeholder: '免費帳號可查開放埠' },
  { id: 'greynoise', label: 'GREYNOISE', placeholder: '免費社群版' },
  { id: 'ipinfo', label: 'IPINFO.IO', placeholder: '免費 50000次/月' },
  { id: 'ipgeo', label: 'IPGEOLOCATION.IO', placeholder: '免費 1000次/天' },
]

const SIGNUP_LINKS = [
  { href: 'https://proxycheck.io/', label: 'proxycheck.io' },
  { href: 'https://www.abuseipdb.com/register', label: 'AbuseIPDB' },
  { href: 'https://www.ipqualityscore.com/', label: 'IPQS' },
  { href: 'https://vpnapi.io/', label: 'vpnapi.io' },
  { href: 'https://account.shodan.io/register', label: 'Shodan' },
  { href: 'https://www.greynoise.io/plans/community', label: 'GreyNoise' },
  { href: 'https://ipinfo.io/signup', label: 'ipinfo.io' },
  { href: 'https://ipgeolocation.io/signup', label: 'ipgeolocation.io' },
]

function trimKeys(keys: ApiKeys): ApiKeys {
  return {
    proxycheck: keys.proxycheck.trim(),
    abuseipdb: keys.abuseipdb.trim(),
    ipqs: keys.ipqs.trim(),
    vpnapi: keys.vpnapi.trim(),
    shodan: keys.shodan.trim(),
    greynoise: keys.greynoise.trim(),
    ipinfo: keys.ipinfo.trim(),
    ipgeo: keys.ipgeo.trim(),
  }
}

function pillMark(state: SourcePill['state']): string {
  if (state === 'ok') return '✓'
  if (state === 'err') return '!'
  return '○'
}

export default function Tool() {
  const [ip, setIp] = useState('')
  const [keys, setKeys] = useState<ApiKeys>(EMPTY_KEYS)
  const [keysOpen, setKeysOpen] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [tab, setTab] = useState('overview')

  async function fillMyIp() {
    try {
      const detected = await detectMyIp()
      setIp(detected)
      setError('')
    } catch {
      setError('無法偵測目前的 IP')
    }
  }

  async function run() {
    setPhase('loading')
    setError('')
    setResult(null)
    const typed = ip.trim()
    setStatusText(typed ? `查詢 ${typed}...` : '偵測當前 IP...')
    try {
      let target = typed
      if (!target) {
        const response = await fetch('https://api64.ipify.org?format=json')
        const data = (await response.json()) as { ip?: unknown }
        if (typeof data.ip !== 'string' || !data.ip.trim()) throw new Error('查詢失敗，請確認 IP 格式')
        target = data.ip.trim()
        setIp(target)
      }
      setStatusText(`並行查詢中 ${target}（最多 10 個來源）...`)
      const analysis = await analyzeIp(target, trimKeys(keys))
      setIp(analysis.ip)
      setResult(analysis)
      setStatusText(analysis.statusText)
      setPhase('done')
    } catch (err) {
      setResult(null)
      setStatusText('')
      setError(err instanceof Error && err.message ? err.message : '查詢失敗，請確認 IP 格式')
      setPhase('error')
    }
  }

  const circ = 2 * Math.PI * 38
  const gaugeStroke = !result
    ? 'var(--color-success)'
    : result.score > 60
      ? 'var(--color-danger)'
      : result.score > 30
        ? 'var(--color-warning)'
        : 'var(--color-success)'

  return (
    <div className="ip">
      <section className="ip-card">
        <button
          type="button"
          className="ip-toggle"
          aria-expanded={keysOpen}
          onClick={() => setKeysOpen((open) => !open)}
        >
          <span>API 金鑰設定（選填，啟用更多檢查維度）</span>
          <span>{keysOpen ? '▼ 收起' : '▶ 展開'}</span>
        </button>
        {keysOpen ? (
          <div className="ip-keys-body">
            <div className="ip-keys">
              {KEY_FIELDS.map((field) => (
                <Field
                  key={field.id}
                  className="ip-key"
                  label={field.label}
                  type="password"
                  autoComplete="off"
                  placeholder={field.placeholder}
                  value={keys[field.id]}
                  onChange={(event) => setKeys((current) => ({ ...current, [field.id]: event.target.value }))}
                />
              ))}
            </div>
            <p className="ip-links">
              免費申請：
              {SIGNUP_LINKS.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
              ))}
            </p>
            <p className="ip-note">金鑰只留在這個頁面，重新整理後需再輸入。AbuseIPDB 因瀏覽器 CORS 限制不會送出查詢。</p>
          </div>
        ) : null}
      </section>

      <div className="ip-search">
        <Field
          className="ip-key"
          label="IP 地址"
          value={ip}
          placeholder="輸入 IP 地址（IPv4 / IPv6），或留空自動偵測"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setIp(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void run()
            }
          }}
        />
        <Button disabled={phase === 'loading'} onClick={() => void run()}>分析</Button>
      </div>
      <p className="ip-note">
        自動偵測：
        <button type="button" className="ip-link" onClick={() => void fillMyIp()}>點此填入我的 IP</button>
        <span> · 按 Enter 觸發查詢</span>
      </p>

      {phase === 'loading' || phase === 'done' ? (
        <p className="ip-status" role="status">
          <span className={phase === 'loading' ? 'ip-spinner' : `ip-dot is-${result?.dot ?? 'ok'}`} />
          <span>{statusText}</span>
        </p>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {result ? (
        <div className="ip-results">
          <div className="ip-pills" aria-label="資料來源">
            {result.pills.map((pill) => (
              <span key={pill.name} className={`ip-pill is-${pill.state}`}>{pillMark(pill.state)} {pill.name}</span>
            ))}
          </div>
          <section className="ip-score" aria-label={`風險分數 ${result.score} / 100`}>
            <svg className="ip-gauge" viewBox="0 0 96 96" aria-hidden>
              <circle cx="48" cy="48" r="38" fill="none" stroke="var(--color-border)" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke={gaugeStroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(result.score / 100) * circ} ${circ}`}
                transform="rotate(-90 48 48)"
              />
              <text x="48" y="45" className="ip-gauge-value">{result.score}</text>
              <text x="48" y="61" className="ip-gauge-label">/ 100</text>
            </svg>
            <div>
              <p className={`ip-level is-${result.levelTone}`}>{result.level}</p>
              <p className="ip-note">{result.description}</p>
              <div className="ip-badges">
                {result.badges.map((badge) => (
                  <span key={badge.text} className={`ip-badge is-${badge.tone}`}>{badge.text}</span>
                ))}
              </div>
            </div>
          </section>
          <Tabs
            label="分析結果"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: '總覽', content: <Overview result={result} /> },
              {
                id: 'geo',
                label: '地理與網路',
                content: (
                  <div className="ip-stack">
                    <div className="ip-grid ip-grid-2">
                      <Panel title="地理位置" rows={result.geo} />
                      <Panel title="網路資訊" rows={result.net} />
                    </div>
                    <div className="ip-grid ip-grid-2">
                      <Panel title="時區與語系" rows={result.loc} />
                      <Panel title="路由資訊" rows={result.route} />
                    </div>
                  </div>
                ),
              },
              {
                id: 'threat',
                label: '威脅情報',
                content: (
                  <div className="ip-stack">
                    <div className="ip-grid ip-grid-2">
                      <Panel title="匿名偵測" rows={result.anon} />
                      <Panel title="濫用記錄" rows={result.abuse} />
                    </div>
                    <div className="ip-grid ip-grid-2">
                      <Panel title="GreyNoise 情報" rows={result.greynoise} />
                      <Panel title="proxycheck.io" rows={result.proxycheck} />
                    </div>
                  </div>
                ),
              },
              {
                id: 'infra',
                label: '基礎設施',
                content: (
                  <div className="ip-grid ip-grid-2">
                    <section className="ip-panel">
                      <h3>Shodan 開放埠</h3>
                      {result.shodanNote ? <p className="ip-note">{result.shodanNote}</p> : (
                        <div className="ip-ports">
                          {result.ports.map((item) => (
                            <span key={item.port} className={item.danger ? 'ip-port is-danger' : 'ip-port is-safe'}>{item.port}</span>
                          ))}
                        </div>
                      )}
                      <Rows rows={result.shodan} />
                    </section>
                    <Panel title="基礎設施類型" rows={result.infra} />
                  </div>
                ),
              },
              {
                id: 'policy',
                label: '合規與政策',
                content: (
                  <div className="ip-grid ip-grid-3">
                    <Panel title="制裁名單" rows={result.sanction} />
                    <Panel title="地理限制" rows={result.geoPolicy} />
                    <Panel title="GDPR 與隱私" rows={result.gdpr} />
                  </div>
                ),
              },
              { id: 'ai', label: 'AI 建議', content: <Advice result={result} /> },
              {
                id: 'raw',
                label: '原始資料',
                content: (
                  <div className="ip-stack">
                    <p className="ip-note">所有 API 原始回應</p>
                    <pre className="ip-raw">{JSON.stringify(result.raw, null, 2)}</pre>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {phase === 'idle' || phase === 'error' ? (
        <div className="ip-empty">
          <p className="ip-empty-title">IP 多維度風控分析</p>
          <p>整合 10+ 個資料來源，涵蓋威脅情報、地理位置、開放埠、國家制裁、GDPR 合規等多個維度。</p>
        </div>
      ) : null}
    </div>
  )
}

function Overview({ result }: { result: Analysis }) {
  const tone = result.score > 60 ? 'danger' : result.score > 30 ? 'warn' : 'ok'
  return (
    <div className="ip-stack">
      <section className="ip-panel">
        <h3>評分來源分解（加權平均）</h3>
        {result.comps.map((part) => {
          const width = Math.min(100, part.score)
          const bar = width > 60 ? 'danger' : width > 30 ? 'warn' : 'ok'
          return (
            <div key={part.src} className="ip-bar-row">
              <span>{part.label} <span className="ip-note">（×{part.weight}）</span></span>
              <span className="ip-bar"><span className={`is-${bar}`} style={{ width: `${width}%` }} /></span>
              <strong className={`is-${bar}`}>{part.score}</strong>
            </div>
          )
        })}
        <div className="ip-total">
          <span>加權綜合分數</span>
          <strong className={`is-${tone}`}>{result.score} / 100</strong>
        </div>
      </section>
      <div className="ip-flags">
        {result.flags.map((flag) => (
          <article key={flag.name} className={flag.type ? `ip-flag is-${flag.type}` : 'ip-flag'}>
            <span aria-hidden>{flag.icon}</span>
            <div>
              <p>{flag.name}</p>
              <p>{flag.value}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Panel({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="ip-panel">
      <h3>{title}</h3>
      <Rows rows={rows} />
    </section>
  )
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="ip-kv">
      {rows.map((item, index) =>
        item.divider ? (
          <hr key={`divider-${index}`} />
        ) : (
          <div key={`${item.label}-${index}`} className="ip-kv-row">
            <dt>{item.label}</dt>
            <dd className={item.tone ? `is-${item.tone}` : undefined}>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer">{item.value}</a>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ),
      )}
    </dl>
  )
}

function Advice({ result }: { result: Analysis }) {
  const tone = result.score > 60 ? 'danger' : result.score > 30 ? 'warn' : 'ok'
  return (
    <div className="ip-stack">
      <section className="ip-panel">
        <h3>AI 風險綜合評估</h3>
        <p>
          IP 地址 <code>{result.ai.ip}</code> 來自 <strong>{result.ai.place}</strong>（{result.ai.org}），綜合風險評分{' '}
          <strong className={`is-${tone}`}>{result.ai.score}/100</strong>（{result.ai.level}）。
        </p>
        {result.ai.risks.length > 0 ? (
          <>
            <p>偵測到以下風險信號：</p>
            <ul className="ip-list">
              {result.ai.risks.map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          </>
        ) : (
          <p className="is-ok">未偵測到明顯風險信號</p>
        )}
        <p>資料來源覆蓋：{result.ai.sources.join('、')}</p>
        <p className="ip-note">本工具基於公開 API 資料，評分僅供參考，並非確定性判斷。建議結合業務行為數據進行最終決策。</p>
      </section>
      <section className="ip-panel">
        <h3>建議應對措施</h3>
        <div className="ip-actions">
          {result.actions.map((action) => (
            <article key={action.title}>
              <span aria-hidden>{action.icon}</span>
              <div>
                <p>{action.title}</p>
                <p className="ip-note">{action.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
