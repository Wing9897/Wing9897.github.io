export type ApiKeys = {
  proxycheck: string
  abuseipdb: string
  ipqs: string
  vpnapi: string
  shodan: string
  greynoise: string
  ipinfo: string
  ipgeo: string
}

export type Tone = 'danger' | 'warn' | 'ok' | 'info' | 'muted' | 'accent'

export type Row = {
  label: string
  value: string
  tone?: Tone
  href?: string
  divider?: boolean
}

export type FlagItem = {
  icon: string
  name: string
  value: string
  type: 'risk' | 'warn' | 'ok' | 'info' | ''
}

export type BadgeItem = {
  text: string
  tone: 'blue' | 'gray' | 'red' | 'yellow' | 'green' | 'purple' | 'info'
}

export type ScorePart = {
  label: string
  score: number
  weight: number
  src: string
}

export type SourcePill = {
  name: string
  state: 'ok' | 'err' | 'skip'
}

export type PortItem = { port: number; danger: boolean }

export type Analysis = {
  ip: string
  cc: string
  score: number
  level: string
  levelTone: 'danger' | 'warn' | 'ok'
  description: string
  dot: 'bad' | 'warn' | 'ok'
  statusText: string
  comps: ScorePart[]
  pills: SourcePill[]
  badges: BadgeItem[]
  flags: FlagItem[]
  geo: Row[]
  net: Row[]
  loc: Row[]
  route: Row[]
  anon: Row[]
  abuse: Row[]
  greynoise: Row[]
  proxycheck: Row[]
  ports: PortItem[]
  shodanNote: string
  shodan: Row[]
  infra: Row[]
  sanction: Row[]
  geoPolicy: Row[]
  gdpr: Row[]
  ai: {
    ip: string
    place: string
    org: string
    score: number
    level: string
    risks: string[]
    sources: string[]
  }
  actions: { icon: string; title: string; desc: string }[]
  raw: unknown
}

const SANCTIONED = ['CU', 'IR', 'KP', 'SY', 'RU', 'BY', 'MM', 'VE', 'SD', 'SO', 'YE', 'ZW', 'LY', 'CF', 'SS', 'HT']
const HIGH_RISK = ['CN', 'NG', 'UA', 'VN', 'PK', 'BD', 'ID', 'EG', 'KE', 'GH']
const GDPR_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB',
]
const FIVE_EYES = ['US', 'GB', 'CA', 'AU', 'NZ']
const FOURTEEN_EYES = ['US', 'GB', 'CA', 'AU', 'NZ', 'DK', 'FR', 'NL', 'NO', 'DE', 'BE', 'IT', 'SE', 'ES']
const DANGER_PORTS = [22, 23, 3389, 445, 135, 139, 1433, 3306, 6379, 27017, 5900, 4444, 8080, 8443]
const DATACENTERS = [
  'amazon', 'aws', 'google', 'azure', 'microsoft', 'digitalocean', 'linode', 'vultr', 'cloudflare', 'hetzner',
  'ovh', 'choopa', 'cogent', 'contabo', 'datacamp', 'zscaler', 'alibaba', 'tencent', 'huawei', 'serverius',
  'xtom', 'leaseweb',
]
const SANCTION_NAMES: Record<string, string> = {
  CU: '古巴', IR: '伊朗', KP: '北韓', SY: '敘利亞', RU: '俄羅斯', BY: '白俄羅斯', MM: '緬甸', VE: '委內瑞拉',
  SD: '蘇丹', SO: '索馬利亞', YE: '葉門', ZW: '津巴布韋', LY: '利比亞', CF: '中非共和國', SS: '南蘇丹', HT: '海地',
}

type JsonObject = Record<string, unknown>

function asObj(value: unknown): JsonObject | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  return null
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function intOf(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function row(label: string, value: unknown, tone?: Tone): Row {
  const shown = value == null || value === '' ? '—' : String(value)
  return tone ? { label, value: shown, tone } : { label, value: shown }
}

function yesNo(value: unknown, invert = false): { value: string; tone: 'danger' | 'ok' } {
  const on = !!value
  const bad = invert ? !on : on
  return { value: on ? '是 ⚠' : '否 ✓', tone: bad ? 'danger' : 'ok' }
}

function divider(): Row {
  return { label: '', value: '', divider: true }
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return null
  }
  return null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item !== '')
}

function portList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ports: number[] = []
  for (const item of value) {
    if (typeof item === 'number' && Number.isFinite(item)) ports.push(item)
    else if (typeof item === 'string' && /^\d+$/.test(item)) ports.push(Number(item))
  }
  return ports
}

async function safeFetch(url: string, opts: RequestInit = {}, ms = 7000): Promise<unknown> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), ms)
  try {
    const response = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(tid)
    if (!response.ok) return null
    return await response.json()
  } catch {
    clearTimeout(tid)
    return null
  }
}

function pill(name: string, ok: boolean, key?: string): SourcePill {
  if (ok) return { name, state: 'ok' }
  if (key !== undefined && key === '') return { name, state: 'err' }
  return { name, state: 'skip' }
}

function classTone(value: unknown): Tone {
  if (value === 'malicious') return 'danger'
  if (value === 'benign') return 'ok'
  return 'muted'
}

export async function detectMyIp(): Promise<string> {
  try {
    const response = await fetch('https://api64.ipify.org?format=json')
    const data = (await response.json()) as { ip?: unknown }
    if (typeof data.ip === 'string' && data.ip.trim()) return data.ip.trim()
  } catch {
    /* try the next public endpoint */
  }
  const response = await fetch('https://ipv4.icanhazip.com/')
  const ip = (await response.text()).trim()
  if (!ip) throw new Error('無法偵測目前的 IP')
  return ip
}

export async function analyzeIp(input: string, keys: ApiKeys): Promise<Analysis> {
  let ip = input.trim()
  if (!ip) {
    const response = await fetch('https://api64.ipify.org?format=json')
    const data = (await response.json()) as { ip?: unknown }
    if (typeof data.ip !== 'string' || !data.ip.trim()) throw new Error('查詢失敗，請確認 IP 格式')
    ip = data.ip.trim()
  }

  const [ipapiRaw, ipapicomRaw, ipwhoRaw, proxycheckRaw, vpnapiRaw, ipqsRaw, shodanRaw, greynoiseRaw, ipinfoRaw, ipgeoRaw] =
    await Promise.all([
      safeFetch(`https://ipapi.co/${ip}/json/`),
      safeFetch(
        `https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
      ),
      safeFetch(`https://ipwho.is/${ip}`),
      safeFetch(
        `https://proxycheck.io/v2/${ip}?${keys.proxycheck ? `key=${keys.proxycheck}&` : ''}vpn=1&asn=1&risk=1&port=1&seen=1&days=180&tag=ipcheck`,
      ),
      keys.vpnapi ? safeFetch(`https://vpnapi.io/api/${ip}?key=${keys.vpnapi}`) : Promise.resolve(null),
      keys.ipqs
        ? safeFetch(
            `https://ipqualityscore.com/api/json/ip/${keys.ipqs}/${ip}?strictness=1&allow_public_access_points=true&fast=false&mobile=false`,
          )
        : Promise.resolve(null),
      keys.shodan ? safeFetch(`https://api.shodan.io/shodan/host/${ip}?key=${keys.shodan}`) : Promise.resolve(null),
      keys.greynoise
        ? safeFetch(`https://api.greynoise.io/v3/community/${ip}`, { headers: { key: keys.greynoise } })
        : Promise.resolve(null),
      keys.ipinfo ? safeFetch(`https://ipinfo.io/${ip}?token=${keys.ipinfo}`) : Promise.resolve(null),
      keys.ipgeo
        ? safeFetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${keys.ipgeo}&ip=${ip}&fields=security`)
        : Promise.resolve(null),
    ])

  const ipapi = asObj(ipapiRaw)
  const ipapicom = asObj(ipapicomRaw)
  const ipwho = asObj(ipwhoRaw)
  const proxycheckRoot = asObj(proxycheckRaw)
  const pc = asObj(proxycheckRoot ? proxycheckRoot[ip] : null)
  const vpnapi = asObj(vpnapiRaw)
  const ipqs = asObj(ipqsRaw)
  const shodan = asObj(shodanRaw)
  const greynoise = asObj(greynoiseRaw)
  const ipinfo = asObj(ipinfoRaw)
  const ipgeo = asObj(ipgeoRaw)

  // AbuseIPDB 只保留金鑰欄位；原始頁面因 CORS 沒有實際送出查詢。
  void keys.abuseipdb

  if (ipapi && ipapi.error) {
    const reason = text(ipapi.reason)
    throw new Error(reason || '無效 IP 地址')
  }

  const vpnSecurity = asObj(vpnapi?.security)
  const whoConn = asObj(ipwho?.connection)
  const whoZone = asObj(ipwho?.timezone)
  const geoSecurity = asObj(ipgeo?.security)
  const cc = text(ipapi?.country_code) || text(ipapicom?.countryCode) || text(ipwho?.country_code) || text(ipinfo?.country)

  const isVpn = !!(vpnSecurity?.vpn || ipqs?.vpn || lower(pc?.type).includes('vpn') || lower(whoConn?.type) === 'vpn')
  const isTor = !!(vpnSecurity?.tor || ipqs?.tor || lower(pc?.type).includes('tor') || lower(whoConn?.type) === 'tor')
  const isProxy = !!(ipapicom?.proxy || vpnSecurity?.proxy || ipqs?.proxy || pc?.proxy === 'yes')
  const isRelay = !!vpnSecurity?.relay
  const isHosting = !!ipapicom?.hosting
  const isMobile = !!ipapicom?.mobile
  const isBot = !!ipqs?.bot_status

  const orgStr = [ipapicom?.org, ipapicom?.isp, ipapicom?.as, ipapi?.org]
    .map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : ''))
    .join('')
    .toLowerCase()
  const isDatacenter = DATACENTERS.some((key) => orgStr.includes(key)) || isHosting

  const riskPc = intOf(pc?.risk)
  const fraudIpqs = intOf(ipqs?.fraud_score)
  const isMaliciousGn = greynoise?.noise === true && greynoise.classification === 'malicious'
  const isNoiseGn = !!greynoise?.noise
  const isSanctioned = SANCTIONED.includes(cc)
  const isHighRisk = HIGH_RISK.includes(cc)
  const isGdpr = GDPR_COUNTRIES.includes(cc)
  const is5Eyes = FIVE_EYES.includes(cc)
  const is14Eyes = FOURTEEN_EYES.includes(cc)

  const openPorts = portList(shodan?.ports)
  const exposedPorts = openPorts.filter((port) => DANGER_PORTS.includes(port))
  const vulnCount = asObj(shodan?.vulns) ? Object.keys(asObj(shodan?.vulns) as JsonObject).length : 0

  const comps: ScorePart[] = []
  let heuristic = 5
  if (isTor) heuristic += 60
  if (isVpn) heuristic += 40
  if (isProxy) heuristic += 30
  if (isDatacenter) heuristic += 15
  if (isMobile) heuristic -= 5
  if (isBot) heuristic += 20
  comps.push({ label: '行為啟發式', score: Math.min(99, Math.max(1, heuristic)), weight: 1, src: 'built-in' })
  if (riskPc > 0) comps.push({ label: 'proxycheck.io', score: riskPc, weight: 3, src: 'proxycheck' })
  if (fraudIpqs > 0) comps.push({ label: 'IPQualityScore', score: fraudIpqs, weight: 3, src: 'ipqs' })
  if (vpnapi) {
    let vpnScore = 5
    if (isVpn) vpnScore += 40
    if (isTor) vpnScore += 55
    if (isProxy) vpnScore += 35
    if (isRelay) vpnScore += 20
    comps.push({ label: 'vpnapi.io', score: Math.min(99, vpnScore), weight: 2, src: 'vpnapi' })
  }
  if (greynoise) {
    const greyScore = isMaliciousGn ? 85 : isNoiseGn ? 40 : 5
    comps.push({ label: 'GreyNoise', score: greyScore, weight: 2, src: 'greynoise' })
  }
  if (shodan) {
    comps.push({
      label: 'Shodan 暴露評估',
      score: Math.min(99, 5 + exposedPorts.length * 12 + vulnCount * 8),
      weight: 1,
      src: 'shodan',
    })
  }
  const countryRisk = isSanctioned ? 60 : isHighRisk ? 20 : 0
  if (countryRisk > 0) comps.push({ label: '國家風險加成', score: countryRisk, weight: 1, src: 'policy' })

  const totalWeight = comps.reduce((sum, part) => sum + part.weight, 0)
  const score = Math.min(
    99,
    Math.max(1, Math.round(comps.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight)),
  )
  const level = score > 75 ? '極高風險' : score > 60 ? '高風險' : score > 40 ? '中高風險' : score > 20 ? '中低風險' : '低風險'
  const levelTone: Analysis['levelTone'] = score > 60 ? 'danger' : score > 30 ? 'warn' : 'ok'
  const description =
    score > 60
      ? '多個高可信度來源偵測到威脅，強烈建議拒絕或加強驗證'
      : score > 30
        ? '存在風險信號，建議加入 CAPTCHA 或二次驗證'
        : '未發現明顯威脅，可正常放行'
  const dot: Analysis['dot'] = score > 60 ? 'bad' : score > 25 ? 'warn' : 'ok'

  const country = text(ipapi?.country_name) || text(ipapicom?.country) || '—'
  const asn = text(ipapi?.asn) || text(ipapicom?.as).split(' ')[0] || '—'
  const badges: BadgeItem[] = [{ text: `🌍 ${country}`, tone: 'blue' }]
  if (asn !== '—') badges.push({ text: `📡 ${asn}`, tone: 'gray' })
  if (isTor) badges.push({ text: '🧅 Tor', tone: 'red' })
  if (isVpn) badges.push({ text: '🔒 VPN', tone: 'yellow' })
  if (isProxy) badges.push({ text: '⚡ Proxy', tone: 'red' })
  if (isDatacenter) badges.push({ text: '☁️ 數據中心', tone: 'yellow' })
  if (isBot) badges.push({ text: '🤖 Bot', tone: 'red' })
  if (isSanctioned) badges.push({ text: '🚫 制裁國', tone: 'red' })
  if (isHighRisk && !isSanctioned) badges.push({ text: '⚠️ 高風險地區', tone: 'yellow' })
  if (isMobile) badges.push({ text: '📱 移動', tone: 'green' })
  if (is5Eyes) badges.push({ text: '👁 Five Eyes', tone: 'purple' })
  if (text(greynoise?.name)) badges.push({ text: `🔍 ${text(greynoise?.name)}`, tone: 'info' })

  const flags: FlagItem[] = [
    { icon: '🔒', name: 'VPN', value: isVpn ? '已偵測' : '未偵測', type: isVpn ? 'risk' : 'ok' },
    { icon: '⚡', name: 'Proxy', value: isProxy ? '已偵測' : '未偵測', type: isProxy ? 'risk' : 'ok' },
    { icon: '🧅', name: 'Tor 節點', value: isTor ? '已偵測' : '未偵測', type: isTor ? 'risk' : 'ok' },
    { icon: '☁️', name: '數據中心', value: isDatacenter ? '是' : '否', type: isDatacenter ? 'warn' : 'ok' },
    { icon: '🤖', name: 'Bot 流量', value: isBot ? '已偵測' : '未偵測', type: isBot ? 'risk' : 'ok' },
    { icon: '🔄', name: '中繼節點', value: isRelay ? '已偵測' : '未偵測', type: isRelay ? 'warn' : 'ok' },
    { icon: '📱', name: '移動網路', value: isMobile ? '是' : '否', type: isMobile ? 'ok' : '' },
    {
      icon: '🏠',
      name: '家用寬頻',
      value: !isDatacenter && !isProxy && !isVpn ? '是' : '否',
      type: !isDatacenter && !isProxy && !isVpn ? 'ok' : '',
    },
    { icon: '🚫', name: '制裁國家', value: isSanctioned ? `${cc} ⚠` : '否', type: isSanctioned ? 'risk' : 'ok' },
    { icon: '⚠️', name: '高風險地區', value: isHighRisk ? `${cc}` : '否', type: isHighRisk && !isSanctioned ? 'warn' : 'ok' },
    { icon: '👁', name: 'Five Eyes', value: is5Eyes ? `${cc}` : '否', type: is5Eyes ? 'info' : 'ok' },
  ]
  if (shodan) {
    flags.push({
      icon: '🔌',
      name: '暴露服務埠',
      value: exposedPorts.length > 0 ? `${exposedPorts.length}個` : '無',
      type: exposedPorts.length > 0 ? 'risk' : 'ok',
    })
  }
  if (greynoise) {
    flags.push({
      icon: '📡',
      name: '掃描活動',
      value: isNoiseGn ? (isMaliciousGn ? '惡意掃描' : '已知掃描器') : '無記錄',
      type: isMaliciousGn ? 'risk' : isNoiseGn ? 'warn' : 'ok',
    })
  }
  if (vulnCount > 0) flags.push({ icon: '💀', name: '已知漏洞', value: `${vulnCount}個 CVE`, type: 'risk' })

  const latitude = ipapi?.latitude
  const longitude = ipapi?.longitude
  const coords = latitude && longitude ? `${text(latitude) || String(latitude)}, ${text(longitude) || String(longitude)}` : ''

  const geo: Row[] = [
    row('IP 地址', ip, 'accent'),
    row('國家/地區', `${text(ipapi?.country_name) || text(ipapicom?.country) || '—'} (${cc})`),
    row('城市', text(ipapi?.city) || text(ipapicom?.city) || text(ipwho?.city)),
    row('省份/州', text(ipapi?.region) || text(ipapicom?.regionName)),
    row('郵遞區號', text(ipapi?.postal) || text(ipapicom?.zip)),
    row('座標', coords),
    row('大洲', text(ipapi?.continent_code)),
  ]
  const net: Row[] = [
    row('ASN', asn, 'accent'),
    row('ISP', text(ipapi?.isp) || text(ipapicom?.isp) || text(whoConn?.isp) || text(ipinfo?.org)),
    row('組織', text(ipapi?.org) || text(ipapicom?.org)),
    row('AS 名稱', text(ipapicom?.asname)),
    row('PTR 記錄', text(ipapicom?.reverse) || text(ipinfo?.reverse)),
    row('IP 版本', ip.includes(':') ? 'IPv6' : 'IPv4'),
    row('CIDR', text(ipapi?.network)),
  ]
  const loc: Row[] = [
    row('時區', text(ipapi?.timezone) || text(ipapicom?.timezone) || text(whoZone?.id)),
    row('UTC 偏移', text(ipapi?.utc_offset) || text(whoZone?.utc)),
    row('語系', text(ipapi?.languages)),
    row('貨幣', text(ipapi?.currency)),
    row('國際電話碼', text(ipapi?.country_calling_code)),
    row('連線類型', text(whoConn?.type) || text(pc?.type)),
  ]
  const route: Row[] = [
    row('移動網路', isMobile ? '是' : '否', isMobile ? 'warn' : 'ok'),
    row('數據中心/IDC', isDatacenter ? '是' : '否', isDatacenter ? 'warn' : 'ok'),
    row('代管服務', isHosting ? '是' : '否', isHosting ? 'warn' : 'ok'),
  ]
  if (text(ipinfo?.hostname)) route.push(row('主機名', text(ipinfo?.hostname)))
  if (text(pc?.provider)) route.push(row('服務商', text(pc?.provider)))

  const anonPairs: Array<[string, boolean]> = [
    ['VPN', isVpn],
    ['Proxy', isProxy],
    ['Tor', isTor],
    ['中繼 Relay', isRelay],
    ['Bot', isBot],
  ]
  const anon: Row[] = anonPairs.map(([label, value]) => {
    const mark = yesNo(value)
    return row(label, mark.value, mark.tone)
  })
  anon.push(divider())
  if (riskPc > 0) anon.push(row('proxycheck 風險%', `${riskPc}%`, riskPc > 50 ? 'danger' : riskPc > 25 ? 'warn' : 'ok'))
  if (fraudIpqs > 0) anon.push(row('IPQS 欺詐分', `${fraudIpqs}%`, fraudIpqs > 50 ? 'danger' : fraudIpqs > 25 ? 'warn' : 'ok'))
  if (text(pc?.lastSeen) || text(pc?.['last seen human'])) {
    anon.push(row('最後活躍', text(pc?.['last seen human']) || text(pc?.lastSeen)))
  }
  if (text(pc?.type)) anon.push(row('代理類型', text(pc?.type)))

  const abuse: Row[] = [
    row('AbuseIPDB', '需後端代理（CORS限制）', 'warn'),
    row(
      'GreyNoise',
      greynoise ? text(greynoise.classification) || '無分類' : '未查詢（需Key）',
      classTone(greynoise?.classification),
    ),
  ]
  if (greynoise && greynoise.noise !== undefined) {
    const mark = yesNo(greynoise.noise)
    abuse.push(row('Internet 掃描噪音', mark.value, mark.tone))
  }
  if (greynoise && greynoise.riot !== undefined) {
    const mark = yesNo(greynoise.riot, true)
    abuse.push(row('已知良性服務', mark.value, mark.tone))
  }
  if (text(greynoise?.name)) abuse.push(row('識別名稱', text(greynoise?.name), 'info'))
  if (text(greynoise?.message)) abuse.push(row('說明', text(greynoise?.message)))

  const greyRows: Row[] = []
  if (greynoise) {
    greyRows.push(row('分類', text(greynoise.classification), classTone(greynoise.classification) === 'muted' ? undefined : classTone(greynoise.classification)))
    greyRows.push(row('掃描活動', greynoise.noise ? '是 ⚠' : '否 ✓', greynoise.noise ? 'warn' : 'ok'))
    greyRows.push(row('RIOT 可信', greynoise.riot ? '是 ✓' : '否', greynoise.riot ? 'ok' : undefined))
    const link = httpUrl(greynoise.link)
    if (link) greyRows.push({ label: '詳細資料', value: '查看', href: link, tone: 'accent' })
  } else {
    greyRows.push(row('狀態', '未查詢（填入 GreyNoise Key 啟用）', 'warn'))
  }

  const proxyRows: Row[] = []
  if (pc) {
    proxyRows.push(row('代理偵測', pc.proxy === 'yes' ? '是 ⚠' : '否 ✓', pc.proxy === 'yes' ? 'danger' : 'ok'))
    proxyRows.push(row('類型', text(pc.type)))
    const riskValue = intOf(pc.risk)
    proxyRows.push(row('風險分數', `${riskValue}%`, riskValue > 50 ? 'danger' : riskValue > 25 ? 'warn' : 'ok'))
    proxyRows.push(row('服務商', text(pc.provider)))
    if (text(pc['last seen human'])) proxyRows.push(row('最後活躍', text(pc['last seen human'])))
    if (text(pc.port) || (typeof pc.port === 'number' && pc.port)) proxyRows.push(row('代理埠', text(pc.port) || String(pc.port)))
  } else {
    proxyRows.push(row('狀態', '已查詢（免費版無 Key）'))
  }

  const shodanRows: Row[] = []
  let shodanNote = '未查詢（填入 Shodan Key 啟用）'
  if (shodan) {
    shodanNote = openPorts.length > 0 ? '' : '無開放埠記錄'
    shodanRows.push(row('開放埠數', String(openPorts.length)))
    shodanRows.push(row('危險埠數', String(exposedPorts.length), exposedPorts.length > 0 ? 'danger' : 'ok'))
    shodanRows.push(row('已知漏洞', vulnCount > 0 ? `${vulnCount} CVEs` : '0', vulnCount > 0 ? 'danger' : 'ok'))
    shodanRows.push(row('最後掃描', text(shodan.last_update)))
    const hostnames = stringList(shodan.hostnames)
    if (hostnames[0]) shodanRows.push(row('主機名', hostnames[0]))
    const tags = stringList(shodan.tags)
    if (tags.length > 0) shodanRows.push(row('標籤', tags.join(', '), 'warn'))
  }

  const infra: Row[] = [
    row('數據中心/IDC', isDatacenter ? '是' : '否', isDatacenter ? 'warn' : 'ok'),
    row('代管/Hosting', isHosting ? '是' : '否', isHosting ? 'warn' : 'ok'),
    row('移動網路', isMobile ? '是' : '否'),
    row('家用寬頻', !isDatacenter && !isHosting && !isMobile ? '可能是' : '否'),
    row('組織', text(ipapicom?.org) || text(ipapi?.org)),
    row('連線類型', text(whoConn?.type) || text(geoSecurity?.connection_type)),
  ]
  if (text(geoSecurity?.threat_level)) {
    infra.push(row('ipgeo 威脅等級', text(geoSecurity?.threat_level), text(geoSecurity?.threat_level) !== 'low' ? 'warn' : 'ok'))
  }

  const sanction: Row[] = [
    row('OFAC 制裁', isSanctioned ? `${SANCTION_NAMES[cc] || cc} ⚠` : '不在名單內', isSanctioned ? 'danger' : 'ok'),
    row('UN 制裁', isSanctioned ? '可能受影響' : '無'),
    row('高風險地區', isHighRisk ? '是 ⚠' : '否', isHighRisk ? 'warn' : 'ok'),
    divider(),
    row('國家代碼', cc),
    row('風險等級', isSanctioned ? '制裁國' : isHighRisk ? '高風險' : '正常', isSanctioned ? 'danger' : isHighRisk ? 'warn' : 'ok'),
  ]
  const geoPolicy: Row[] = [
    row('中國大陸', cc === 'CN' ? '是 ⚠' : '否', cc === 'CN' ? 'warn' : 'ok'),
    row('俄羅斯', cc === 'RU' ? '是 ⚠' : '否', cc === 'RU' ? 'warn' : 'ok'),
    row('北韓', cc === 'KP' ? '是 ⚠' : '否', cc === 'KP' ? 'danger' : 'ok'),
    row('14眼聯盟', is14Eyes ? cc : '否', is14Eyes ? 'warn' : 'ok'),
    row('5眼聯盟', is5Eyes ? cc : '否', is5Eyes ? 'info' : 'ok'),
  ]
  const gdpr: Row[] = [
    row('GDPR 適用', isGdpr ? '是（歐盟/EEA）' : '否', isGdpr ? 'info' : undefined),
    row('資料傳輸', isGdpr ? '受 GDPR 保護' : '標準規範'),
    row('隱私投訴', isGdpr ? '可向 DPA 投訴' : '依當地法律'),
  ]

  const risks: string[] = []
  if (isTor) risks.push('Tor 匿名網路')
  if (isVpn) risks.push('VPN 服務')
  if (isProxy) risks.push('代理伺服器')
  if (isBot) risks.push('Bot 流量')
  if (isSanctioned) risks.push(`制裁國家（${cc}）`)
  if (isMaliciousGn) risks.push('GreyNoise 惡意掃描')
  if (exposedPorts.length > 0) risks.push(`${exposedPorts.length}個高危服務埠暴露`)
  if (vulnCount > 0) risks.push(`${vulnCount}個已知CVE漏洞`)
  if (isDatacenter) risks.push('數據中心IP（非家用）')

  const actions: Analysis['actions'] = []
  if (score > 75) {
    actions.push({ icon: '🚫', title: '建議直接拒絕', desc: '風險分數極高，強烈建議阻擋此 IP 的請求' })
    actions.push({ icon: '📝', title: '記錄並監控', desc: '將此 IP 加入黑名單並記錄所有請求日誌' })
  } else if (score > 40) {
    actions.push({ icon: '🔐', title: '強制雙因素驗證', desc: '要求用戶完成 2FA 或 Email 驗證' })
    actions.push({ icon: '🧩', title: '加入 CAPTCHA', desc: '顯示人機驗證挑戰，排除自動化攻擊' })
    actions.push({ icon: '⏱', title: '限制請求頻率', desc: '對此 IP 實施較嚴格的 Rate Limiting' })
  } else {
    actions.push({ icon: '✅', title: '可正常放行', desc: '風險評分在正常範圍，無需額外驗證' })
    actions.push({ icon: '📊', title: '持續監控', desc: '建議記錄行為日誌，異常時觸發重新評估' })
  }
  if (isSanctioned) actions.push({ icon: '⚖️', title: '合規審查', desc: `此 IP 來自制裁國家（${cc}），需確認是否符合您的合規政策` })
  if (isGdpr) actions.push({ icon: '🇪🇺', title: 'GDPR 合規', desc: '此 IP 來自歐盟/EEA，處理其數據需符合 GDPR 規定' })
  if (is5Eyes) actions.push({ icon: '👁', title: 'Five Eyes 注意', desc: `此 IP 位於五眼聯盟國家（${cc}），數據可能受監控法律影響` })

  const raw = {
    ipapi: ipapiRaw,
    ipapicom: ipapicomRaw,
    ipwho: ipwhoRaw,
    'proxycheck.io': proxycheckRaw,
    vpnapi: vpnapiRaw,
    ipqs: ipqsRaw,
    shodan: shodanRaw,
    greynoise: greynoiseRaw,
    ipinfo: ipinfoRaw,
    ipgeo: ipgeoRaw,
  }

  return {
    ip,
    cc,
    score,
    level,
    levelTone,
    description,
    dot,
    statusText: `分析完成 · ${ip} · 風險 ${score}/100 · ${comps.length} 個資料來源`,
    comps,
    pills: [
      pill('ipapi.co', !!ipapi),
      pill('ip-api.com', !!ipapicom),
      pill('ipwho.is', !!ipwho),
      pill('proxycheck.io', !!pc, keys.proxycheck),
      pill('vpnapi.io', !!vpnapi, keys.vpnapi),
      pill('IPQS', !!ipqs, keys.ipqs),
      pill('Shodan', !!shodan, keys.shodan),
      pill('GreyNoise', !!greynoise, keys.greynoise),
      pill('ipinfo.io', !!ipinfo, keys.ipinfo),
      pill('ipgeo.io', !!ipgeo, keys.ipgeo),
    ],
    badges,
    flags,
    geo,
    net,
    loc,
    route,
    anon,
    abuse,
    greynoise: greyRows,
    proxycheck: proxyRows,
    ports: openPorts.slice(0, 30).map((port) => ({ port, danger: DANGER_PORTS.includes(port) })),
    shodanNote,
    shodan: shodanRows,
    infra,
    sanction,
    geoPolicy,
    gdpr,
    ai: {
      ip,
      place: text(ipapi?.country_name) || text(ipapicom?.country) || cc || '未知',
      org: text(ipapi?.org) || text(ipapicom?.isp) || '—',
      score,
      level,
      risks,
      sources: comps.map((part) => part.label),
    },
    actions,
    raw,
  }
}
