import { useEffect, useState } from 'react'
import { Banner, Button, Field, TextArea, labelClass } from '@/components/ui'
import './tool.css'
import {
  JWT_PATTERN,
  decodeJwt,
  generateJwt,
  generateRandomSecret,
  verifyJwt,
  type DecodedJwt,
  type VerifiedJwt,
} from './jwt'

const DEFAULT_PAYLOAD = '{"userId": "123", "username": "user", "role": "admin"}'

type Notice = { tone: 'success' | 'danger' | 'info'; text: string } | null
type Generated = { ok: true; token: string } | { ok: false; message: string } | null
type Checked =
  | { kind: 'idle' }
  | { kind: 'error'; action: 'verify' | 'decode'; message: string }
  | { kind: 'verified'; data: VerifiedJwt }
  | { kind: 'decoded'; data: DecodedJwt }

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const field = document.createElement('textarea')
      field.value = value
      field.setAttribute('readonly', '')
      document.body.append(field)
      field.select()
      const ok = document.execCommand('copy')
      field.remove()
      return ok
    } catch {
      return false
    }
  }
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

export default function Tool() {
  const [secret, setSecret] = useState('')
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD)
  const [expiresIn, setExpiresIn] = useState('3600')
  const [tokenToVerify, setTokenToVerify] = useState('')
  const [generated, setGenerated] = useState<Generated>(null)
  const [checked, setChecked] = useState<Checked>({ kind: 'idle' })
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'danger' ? 5000 : 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function onCopySecret() {
    if (!secret) {
      setNotice({ tone: 'danger', text: '請先輸入或生成 Secret Key！' })
      return
    }
    const ok = await copyText(secret)
    setNotice({ tone: ok ? 'success' : 'danger', text: ok ? '已複製 Secret Key！' : '複製失敗' })
  }

  async function onCopyToken() {
    const token = generated?.ok ? generated.token.match(JWT_PATTERN)?.[0] : undefined
    if (!token) {
      setNotice({ tone: 'danger', text: '尚未生成 JWT Token！' })
      return
    }
    const ok = await copyText(token)
    setNotice({ tone: ok ? 'success' : 'danger', text: ok ? '已複製 JWT Token！' : '複製失敗' })
  }

  async function onGenerate() {
    if (!secret) {
      setNotice({ tone: 'danger', text: '請先輸入或生成 Secret Key！' })
      return
    }
    if (secret.length < 32) {
      setNotice({ tone: 'danger', text: 'Secret key 必須至少 32 個字符！' })
      return
    }
    setBusy(true)
    try {
      const token = await generateJwt(secret, payload, expiresIn)
      setGenerated({ ok: true, token })
      setNotice(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      if (message.includes('Secret')) {
        setNotice({ tone: 'danger', text: message })
      } else {
        setGenerated({ ok: false, message })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onVerify() {
    if (!secret) {
      setNotice({
        tone: 'danger',
        text: '請先輸入 Secret Key！驗證功能需要 Secret Key。如果只想查看 Token 內容，請使用「解碼 JWT」功能。',
      })
      return
    }
    if (!tokenToVerify.trim()) {
      setNotice({ tone: 'danger', text: '請輸入 JWT token！' })
      return
    }
    setBusy(true)
    try {
      const data = await verifyJwt(tokenToVerify, secret)
      setChecked({ kind: 'verified', data })
      setNotice(null)
    } catch (error) {
      setChecked({
        kind: 'error',
        action: 'verify',
        message: error instanceof Error ? error.message : '未知錯誤',
      })
    } finally {
      setBusy(false)
    }
  }

  function onDecode() {
    if (!tokenToVerify.trim()) {
      setNotice({ tone: 'danger', text: '請輸入 JWT token！' })
      return
    }
    try {
      setChecked({ kind: 'decoded', data: decodeJwt(tokenToVerify) })
      setNotice(null)
    } catch (error) {
      setChecked({
        kind: 'error',
        action: 'decode',
        message: error instanceof Error ? error.message : '未知錯誤',
      })
    }
  }

  return (
    <div className="jwt">
      {notice ? <Banner tone={notice.tone === 'success' ? 'success' : notice.tone === 'info' ? 'info' : 'danger'}>{notice.text}</Banner> : null}

      <section className="jwt-card">
        <h2>JWT Secret Key（用來簽名和驗證的密鑰）</h2>
        <Field
          className="jwt-mono"
          label="Secret Key（最少 32 字符）"
          value={secret}
          placeholder="your-secret-key-min-32-chars（輸入或點擊隨機生成）"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setSecret(event.target.value)}
        />
        <div className="jwt-actions">
          <Button onClick={() => setSecret(generateRandomSecret('base64'))}>隨機生成（Base64URL）</Button>
          <Button variant="ghost" onClick={() => setSecret(generateRandomSecret('hex'))}>隨機生成（Hex）</Button>
          <Button variant="ghost" onClick={() => void onCopySecret()}>複製 Secret Key</Button>
        </div>
        <p className="jwt-note">
          Secret key 僅在本地瀏覽器中使用，不會發送到任何伺服器。可以是任意字符串，但建議使用至少 256-bit 強度的隨機字串（Base64URL 或 Hex 格式）。
        </p>
      </section>

      <section className="jwt-card">
        <h2>生成 JWT Token</h2>
        <TextArea
          className="jwt-mono"
          label="Payload（JSON 格式）"
          value={payload}
          placeholder='{"userId": "123", "username": "user", "role": "admin"}'
          spellCheck={false}
          onChange={(event) => setPayload(event.target.value)}
        />
        <Field
          label="過期時間（秒，選填）"
          type="number"
          min={0}
          step={1}
          value={expiresIn}
          placeholder="例如: 3600（1小時）"
          onChange={(event) => setExpiresIn(event.target.value)}
        />
        <div className="jwt-actions">
          <Button disabled={busy} onClick={() => void onGenerate()}>生成 JWT</Button>
          <Button variant="ghost" onClick={() => void onCopyToken()}>複製 JWT</Button>
        </div>
        <div className="jwt-output" role="status">
          <span className={labelClass}>生成的 JWT Token</span>
          {generated?.ok ? (
            <>
              <p className="jwt-ok">成功生成</p>
              <p className="jwt-token">{generated.token}</p>
            </>
          ) : generated ? (
            <p className="jwt-bad">錯誤: {generated.message}</p>
          ) : (
            <p className="jwt-muted">點擊生成按鈕...</p>
          )}
        </div>
      </section>

      <section className="jwt-card">
        <h2>驗證與解碼 JWT Token</h2>
        <TextArea
          className="jwt-mono"
          label="JWT Token"
          value={tokenToVerify}
          placeholder="貼上要驗證或解碼的 JWT token"
          spellCheck={false}
          onChange={(event) => setTokenToVerify(event.target.value)}
        />
        <div className="jwt-actions">
          <Button disabled={busy} onClick={() => void onVerify()}>驗證 JWT（需要 Secret Key）</Button>
          <Button variant="ghost" onClick={onDecode}>解碼 JWT（不需要 Secret Key）</Button>
        </div>
        <div className="jwt-output" role="status">
          <span className={labelClass}>結果</span>
          <CheckResult view={checked} />
        </div>
      </section>
    </div>
  )
}

function CheckResult({ view }: { view: Checked }) {
  if (view.kind === 'idle') return <p className="jwt-muted">等待操作...</p>
  if (view.kind === 'error') {
    const prefix = view.action === 'verify' ? '驗證失敗' : '解碼失敗'
    return <p className="jwt-bad">{prefix}: {view.message}</p>
  }
  if (view.kind === 'verified') {
    const { data } = view
    return (
      <div className="jwt-stack">
        <p className="jwt-ok">簽名驗證成功</p>
        {data.expired === true ? <p className="jwt-bad">Token 已過期</p> : null}
        {data.expired === false ? <p className="jwt-ok">Token 有效，剩餘 {data.remaining} 秒</p> : null}
        <h3>Header</h3>
        <pre className="jwt-code">{pretty(data.header)}</pre>
        <h3>Payload</h3>
        <pre className="jwt-code">{pretty(data.payload)}</pre>
      </div>
    )
  }

  const { data } = view
  return (
    <div className="jwt-stack">
      <p>JWT 結構解析（三部分用 . 分隔）</p>
      <article className="jwt-part jwt-part--header">
        <h3>第一部分: Header（標頭）</h3>
        <p>Base64URL 編碼: <code>{data.headerRaw}</code></p>
        <pre className="jwt-code">{pretty(data.header)}</pre>
        <p className="jwt-note">Header 定義了 Token 的類型 (typ) 和使用的簽名算法 (alg)。這部分只是 Base64URL 編碼，任何人都能解碼查看。</p>
      </article>
      <article className="jwt-part jwt-part--payload">
        <h3>第二部分: Payload（負載）</h3>
        <p>Base64URL 編碼: <code>{data.payloadRaw}</code></p>
        <pre className="jwt-code">{pretty(data.payload)}</pre>
        <p className="jwt-note">
          Payload 包含實際的用戶數據和標準聲明。常見欄位：iat（issued at）是簽發時間，exp（expiration）是過期時間，其餘為自訂數據（如 userId、username、role）。Payload 也只是 Base64URL 編碼，不要在這裡存放敏感信息（如密碼）。
        </p>
      </article>
      <article className="jwt-part jwt-part--signature">
        <h3>第三部分: Signature（簽名）</h3>
        <p>簽名值: <code>{data.signature}</code></p>
        <p className="jwt-note">
          Signature 是使用 Secret Key 對前兩部分（Header.Payload）進行 HMAC-SHA256 簽名的結果。計算公式：HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)。只有持有正確 Secret Key 的人才能生成或驗證有效的簽名。此處僅顯示簽名值，未驗證其有效性。若要驗證簽名，請使用「驗證 JWT」。
        </p>
      </article>
      <Banner tone="warning" title="JWT 安全機制">
        <ul className="jwt-list">
          <li>編碼與加密不同：Header 和 Payload 只是 Base64URL 編碼，任何人都能解碼查看。</li>
          <li>安全來自簽名：Signature 使用 Secret Key 簽名，用來防止篡改。</li>
          <li>完整性：修改任何部分都會導致簽名驗證失敗。</li>
          <li>不要在 Payload 中存放敏感信息，Secret Key 必須保密。</li>
        </ul>
      </Banner>
    </div>
  )
}
