import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type ToolCategory = 'api' | 'scanner' | 'chart' | 'crypto' | 'image' | 'data' | 'security'

export type CategoryKey = 'all' | ToolCategory

export type ToolView = LazyExoticComponent<ComponentType>

export interface Tool {
  id: string
  View: ToolView
  title: string
  emoji: string
  category: ToolCategory
  categoryLabel: string
  description: string
  tags: string[]
}

export type AccentName = 'neutral' | 'blue' | 'violet' | 'amber' | 'cyan' | 'green' | 'pink' | 'orange'

export interface AccentStyle {
  tile: string
  label: string
  mark: string
  navIdle: string
  navActive: string
  chipIdle: string
  chipActive: string
}

export interface Category {
  key: CategoryKey
  label: string
  accent: AccentName
}

export const ACCENT_STYLES: Record<AccentName, AccentStyle> = {
  neutral: {
    tile: 'bg-surface-2',
    label: 'bg-surface-2 text-text-muted',
    mark: 'bg-text-muted',
    navIdle: 'border-transparent bg-transparent text-text hover:bg-row-hover',
    navActive:
      'border-transparent bg-surface-2 font-semibold text-text hover:bg-surface-2',
    chipIdle: 'border-border bg-surface text-text hover:bg-surface-2',
    chipActive: 'border-text bg-text font-semibold text-bg hover:bg-text',
  },
  blue: {
    tile: 'bg-blue-200 dark:bg-blue-400/25',
    label: 'bg-blue-100 text-blue-900 dark:bg-blue-400/20 dark:text-blue-100',
    mark: 'bg-blue-600 dark:bg-blue-400',
    navIdle:
      'border-transparent bg-transparent text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-400/10',
    navActive:
      'border-transparent bg-blue-100 font-semibold text-blue-950 hover:bg-blue-100 dark:bg-blue-400/20 dark:text-blue-50 dark:hover:bg-blue-400/25',
    chipIdle: 'border-blue-400 bg-surface text-blue-800 hover:bg-blue-50 dark:border-blue-400/70 dark:text-blue-200 dark:hover:bg-blue-400/10',
    chipActive:
      'border-blue-500 bg-blue-100 font-semibold text-blue-950 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-400/20 dark:text-blue-50 dark:hover:bg-blue-400/25',
  },
  violet: {
    tile: 'bg-violet-200 dark:bg-violet-400/25',
    label: 'bg-violet-100 text-violet-950 dark:bg-violet-400/20 dark:text-violet-100',
    mark: 'bg-violet-600 dark:bg-violet-400',
    navIdle:
      'border-transparent bg-transparent text-violet-800 hover:bg-violet-50 dark:text-violet-200 dark:hover:bg-violet-400/10',
    navActive:
      'border-transparent bg-violet-100 font-semibold text-violet-950 hover:bg-violet-100 dark:bg-violet-400/20 dark:text-violet-50 dark:hover:bg-violet-400/25',
    chipIdle:
      'border-violet-400 bg-surface text-violet-800 hover:bg-violet-50 dark:border-violet-400/70 dark:text-violet-200 dark:hover:bg-violet-400/10',
    chipActive:
      'border-violet-500 bg-violet-100 font-semibold text-violet-950 hover:bg-violet-100 dark:border-violet-400 dark:bg-violet-400/20 dark:text-violet-50 dark:hover:bg-violet-400/25',
  },
  amber: {
    tile: 'bg-amber-200 dark:bg-amber-400/25',
    label: 'bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100',
    mark: 'bg-amber-500 dark:bg-amber-400',
    navIdle:
      'border-transparent bg-transparent text-amber-900 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-400/10',
    navActive:
      'border-transparent bg-amber-100 font-semibold text-amber-950 hover:bg-amber-100 dark:bg-amber-400/20 dark:text-amber-50 dark:hover:bg-amber-400/25',
    chipIdle: 'border-amber-500 bg-surface text-amber-950 hover:bg-amber-50 dark:border-amber-400/70 dark:text-amber-200 dark:hover:bg-amber-400/10',
    chipActive:
      'border-amber-600 bg-amber-100 font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-400/20 dark:text-amber-50 dark:hover:bg-amber-400/25',
  },
  cyan: {
    tile: 'bg-cyan-200 dark:bg-cyan-400/25',
    label: 'bg-cyan-100 text-cyan-950 dark:bg-cyan-400/20 dark:text-cyan-100',
    mark: 'bg-cyan-600 dark:bg-cyan-400',
    navIdle:
      'border-transparent bg-transparent text-cyan-900 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-400/10',
    navActive:
      'border-transparent bg-cyan-100 font-semibold text-cyan-950 hover:bg-cyan-100 dark:bg-cyan-400/20 dark:text-cyan-50 dark:hover:bg-cyan-400/25',
    chipIdle: 'border-cyan-500 bg-surface text-cyan-950 hover:bg-cyan-50 dark:border-cyan-400/70 dark:text-cyan-200 dark:hover:bg-cyan-400/10',
    chipActive:
      'border-cyan-600 bg-cyan-100 font-semibold text-cyan-950 hover:bg-cyan-100 dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-cyan-50 dark:hover:bg-cyan-400/25',
  },
  green: {
    tile: 'bg-green-200 dark:bg-green-400/25',
    label: 'bg-green-100 text-green-950 dark:bg-green-400/20 dark:text-green-100',
    mark: 'bg-green-600 dark:bg-green-400',
    navIdle:
      'border-transparent bg-transparent text-green-800 hover:bg-green-50 dark:text-green-200 dark:hover:bg-green-400/10',
    navActive:
      'border-transparent bg-green-100 font-semibold text-green-950 hover:bg-green-100 dark:bg-green-400/20 dark:text-green-50 dark:hover:bg-green-400/25',
    chipIdle: 'border-green-500 bg-surface text-green-800 hover:bg-green-50 dark:border-green-400/70 dark:text-green-200 dark:hover:bg-green-400/10',
    chipActive:
      'border-green-600 bg-green-100 font-semibold text-green-950 hover:bg-green-100 dark:border-green-400 dark:bg-green-400/20 dark:text-green-50 dark:hover:bg-green-400/25',
  },
  pink: {
    tile: 'bg-pink-200 dark:bg-pink-400/25',
    label: 'bg-pink-100 text-pink-950 dark:bg-pink-400/20 dark:text-pink-100',
    mark: 'bg-pink-600 dark:bg-pink-400',
    navIdle:
      'border-transparent bg-transparent text-pink-800 hover:bg-pink-50 dark:text-pink-200 dark:hover:bg-pink-400/10',
    navActive:
      'border-transparent bg-pink-100 font-semibold text-pink-950 hover:bg-pink-100 dark:bg-pink-400/20 dark:text-pink-50 dark:hover:bg-pink-400/25',
    chipIdle: 'border-pink-400 bg-surface text-pink-800 hover:bg-pink-50 dark:border-pink-400/70 dark:text-pink-200 dark:hover:bg-pink-400/10',
    chipActive:
      'border-pink-500 bg-pink-100 font-semibold text-pink-950 hover:bg-pink-100 dark:border-pink-400 dark:bg-pink-400/20 dark:text-pink-50 dark:hover:bg-pink-400/25',
  },
  orange: {
    tile: 'bg-orange-200 dark:bg-orange-400/25',
    label: 'bg-orange-100 text-orange-950 dark:bg-orange-400/20 dark:text-orange-100',
    mark: 'bg-orange-600 dark:bg-orange-400',
    navIdle:
      'border-transparent bg-transparent text-orange-900 hover:bg-orange-50 dark:text-orange-200 dark:hover:bg-orange-400/10',
    navActive:
      'border-transparent bg-orange-100 font-semibold text-orange-950 hover:bg-orange-100 dark:bg-orange-400/20 dark:text-orange-50 dark:hover:bg-orange-400/25',
    chipIdle:
      'border-orange-500 bg-surface text-orange-950 hover:bg-orange-50 dark:border-orange-400/70 dark:text-orange-200 dark:hover:bg-orange-400/10',
    chipActive:
      'border-orange-600 bg-orange-100 font-semibold text-orange-950 hover:bg-orange-100 dark:border-orange-400 dark:bg-orange-400/20 dark:text-orange-50 dark:hover:bg-orange-400/25',
  },
}

export const CATEGORIES: Category[] = [
  { key: 'all', label: '全部工具', accent: 'neutral' },
  { key: 'api', label: 'API工具', accent: 'blue' },
  { key: 'scanner', label: '掃描工具', accent: 'violet' },
  { key: 'chart', label: '圖表工具', accent: 'amber' },
  { key: 'crypto', label: '區塊鏈工具', accent: 'green' },
  { key: 'image', label: '圖像工具', accent: 'pink' },
  { key: 'data', label: '數據工具', accent: 'cyan' },
  { key: 'security', label: '安全工具', accent: 'orange' },
]

const accentByCategory = new Map(CATEGORIES.map((item) => [item.key, ACCENT_STYLES[item.accent]]))

export function accentFor(key: CategoryKey): AccentStyle {
  return accentByCategory.get(key) ?? ACCENT_STYLES.neutral
}

export const TOOLS: Tool[] = [
  {
    id: 'batch-http-advanced',
    View: lazy(() => import('@/tools/batch-http-advanced')),
    title: '批量HTTP請求器 (進階版)',
    emoji: '🔁',
    category: 'api',
    categoryLabel: 'API工具',
    description: '支援複雜雙層循環參數的進階API批量發送工具，具備完整的UI優化和智能滾動功能，適合大規模API測試。',

    tags: ['雙層循環', '批量處理', '進階UI'],


  },
  {
    id: 'batch-http-standard',
    View: lazy(() => import('@/tools/batch-http-standard')),
    title: '批量HTTP請求器 (標準版)',
    emoji: '📤',
    category: 'api',
    categoryLabel: 'API工具',
    description: '簡潔高效的API批量發送工具，支援多重循環參數設定，適合日常API測試和自動化任務。',

    tags: ['多重循環', '自動化', '簡潔介面'],


  },
  {
    id: 'batch-http-qrcode',
    View: lazy(() => import('@/tools/batch-http-qrcode')),
    title: '批量HTTP請求器 (QR碼版)',
    emoji: '📷',
    category: 'api',
    categoryLabel: 'API工具',
    description: '結合QR碼掃描與批量API請求的創新工具，可讀取QR碼內容作為參數，配合TSV數據批量處理。',

    tags: ['QR碼掃描', '參數化', '批量處理'],


  },
  {
    id: 'batch-http-tsv',
    View: lazy(() => import('@/tools/batch-http-tsv')),
    title: '批量HTTP請求器 (TSV版)',
    emoji: '📋',
    category: 'api',
    categoryLabel: 'API工具',
    description: '支援TSV格式數據的通用批量HTTP請求工具，為每個數據行自動生成獨立請求，適合數據遷移和批量操作。',

    tags: ['TSV格式', '數據遷移', '批量操作'],


  },
  {
    id: 'stock-downloader',
    View: lazy(() => import('@/tools/stock-downloader')),
    title: '股票數據下載器',
    emoji: '📉',
    category: 'data',
    categoryLabel: '數據工具',
    description: '一個用於下載股票市場數據的工具，支援多種數據源和格式。',

    tags: ['股票', '數據下載', 'CSV'],


  },
  {
    id: 'qr-scanner-single',
    View: lazy(() => import('@/tools/qr-scanner-single')),
    title: '實時單參數QR Code匹配器',
    emoji: '🔍',
    category: 'scanner',
    categoryLabel: '掃描工具',
    description: '即時掃描QR碼並提供文字搜索功能，可快速從多個QR碼中找出包含特定內容的目標，支援高亮顯示。',

    tags: ['即時掃描', '文字搜索', '高亮顯示'],


  },
  {
    id: 'qr-scanner-keyvalue',
    View: lazy(() => import('@/tools/qr-scanner-keyvalue')),
    title: '實時鍵值對QR Code匹配器',
    emoji: '🔑',
    category: 'scanner',
    categoryLabel: '掃描工具',
    description: '支援鍵值對格式的QR碼掃描工具，可即時匹配掃描結果與預設的鍵值對數據，適合複雜的資料對應需求。',

    tags: ['鍵值對', '即時匹配', '複雜對應'],


  },
  {
    id: 'qr-scanner-batch-tsv',
    View: lazy(() => import('@/tools/qr-scanner-batch-tsv')),
    title: 'Excel風格QR碼映射工具',
    emoji: '📊',
    category: 'scanner',
    categoryLabel: '掃描工具',
    description: '仿Excel介面的QR碼對照工具，支援批量TSV數據導入，掃描後即時顯示對應數值，適合庫存管理和資料比對。',

    tags: ['Excel風格', '批量導入', '即時匹配'],


  },
  {
    id: 'sqlite-chart-chartjs',
    View: lazy(() => import('@/tools/sqlite-chart-chartjs')),
    title: 'SQLite Chart Viewer (Chart.js)',
    emoji: '📈',
    category: 'chart',
    categoryLabel: '圖表工具',
    description: '基於Chart.js的輕量級SQLite數據圖表生成工具，簡潔高效，適合快速生成基本圖表分析。',

    tags: ['Chart.js', '輕量級', '快速分析'],


  },
  {
    id: 'sqlite-chart-echarts',
    View: lazy(() => import('@/tools/sqlite-chart-echarts')),
    title: 'SQLite Chart Viewer (ECharts)',
    emoji: '🥧',
    category: 'chart',
    categoryLabel: '圖表工具',
    description: '使用ECharts函式庫的SQLite數據可視化工具，支援多種圖表類型，提供豐富的交互功能和美觀的圖表效果。',

    tags: ['ECharts', 'SQLite', '數據可視化'],


  },
  {
    id: 'tsv-excel-charts',
    View: lazy(() => import('@/tools/tsv-excel-charts')),
    title: 'TSV / Excel 圖表產生器',
    emoji: '📉',
    category: 'chart',
    categoryLabel: '圖表工具',
    description: '支援TSV和Excel格式的通用圖表生成工具，可直接導入表格數據並生成多種類型的可視化圖表。',

    tags: ['TSV/Excel', '通用格式', '多種圖表'],


  },
  {
    id: 'metamask-testnet',
    View: lazy(() => import('@/tools/metamask-testnet')),
    title: 'MetaMask 測試交易平台',
    emoji: '🦊',
    category: 'crypto',
    categoryLabel: '區塊鏈工具',
    description: '專業的MetaMask區塊鏈測試平台，支援多種測試網絡，提供完整的加密貨幣開發和測試環境。',

    tags: ['MetaMask', '測試網絡', '區塊鏈'],


  },
  {
    id: 'phantom-solana-testnet',
    View: lazy(() => import('@/tools/phantom-solana-testnet')),
    title: 'Phantom Solana 測試平台',
    emoji: '👻',
    category: 'crypto',
    categoryLabel: '區塊鏈工具',
    description: '專業的Phantom區塊鏈測試平台，支援Solana測試網絡，提供完整的加密貨幣開發和測試環境。',

    tags: ['Phantom', 'Solana', '區塊鏈'],


  },
  {
    id: 'blockchain-list',
    View: lazy(() => import('@/tools/blockchain-list')),
    title: '區塊鏈項目列表',
    emoji: '⛓️',
    category: 'crypto',
    categoryLabel: '區塊鏈工具',
    description: '完整的區塊鏈項目列表，提供各種區塊鏈項目的詳細資訊和圖標，方便查看和了解不同的區塊鏈生態系統。',

    tags: ['Blockchain', '項目列表', '生態系統'],


  },
  {
    id: 'crypto-binance',
    View: lazy(() => import('@/tools/crypto-binance')),
    title: 'Binance 加密貨幣數據爬蟲',
    emoji: '₿',
    category: 'crypto',
    categoryLabel: '區塊鏈工具',
    description: '從Binance交易所獲取加密貨幣市場數據的爬蟲工具，支援即時價格、交易量等數據抓取與分析。',

    tags: ['Binance', '數據爬蟲', '市場數據'],


  },
  {
    id: 'crypto-coinbase',
    View: lazy(() => import('@/tools/crypto-coinbase')),
    title: 'Coinbase 加密貨幣數據爬蟲',
    emoji: '🪙',
    category: 'crypto',
    categoryLabel: '區塊鏈工具',
    description: '從Coinbase交易所獲取加密貨幣市場數據的爬蟲工具，支援即時價格、交易量等數據抓取與分析。',

    tags: ['Coinbase', '數據爬蟲', '市場數據'],


  },
  {
    id: 'paint-tool',
    View: lazy(() => import('@/tools/paint-tool')),
    title: '圖像處理工具',
    emoji: '🎨',
    category: 'image',
    categoryLabel: '圖像工具',
    description: '功能豐富的圖像處理工具，支援多種圖像編輯和處理功能，提供專業的圖像處理解決方案。',

    tags: ['圖像編輯', '圖像處理', '專業工具'],


  },
  {
    id: 'web3-signature',
    View: lazy(() => import('@/tools/web3-signature')),
    title: 'Web3 多鏈錢包簽名工具',
    emoji: '✍️',
    category: 'security',
    categoryLabel: '安全工具',
    description: '支援多條區塊鏈的Web3錢包簽名驗證工具，可進行訊息簽名、驗證簽名等操作，適合DApp開發測試。',

    tags: ['Web3', '錢包簽名', '多鏈支援'],


  },
  {
    id: 'jwt-generator',
    View: lazy(() => import('@/tools/jwt-generator')),
    title: 'JWT Token 生成器',
    emoji: '🔐',
    category: 'security',
    categoryLabel: '安全工具',
    description: 'JSON Web Token生成與解析工具，支援多種演算法，可自訂Payload和Header，適合API認證開發測試。',

    tags: ['JWT', 'Token', 'API認證'],


  },
  {
    id: 'ip-risk-checker',
    View: lazy(() => import('@/tools/ip-risk-checker')),
    title: 'IP 風控分析器 Pro',
    emoji: '🛡️',
    category: 'security',
    categoryLabel: '安全工具',
    description: '整合多個資料來源，檢查 IP 的威脅情報、地理位置、VPN、開放埠與風險。',

    tags: ['IP', '風控', '威脅情報'],


  },
]

const toolsById = new Map(TOOLS.map((tool) => [tool.id, tool]))

export function getTool(id: string): Tool | undefined {
  return toolsById.get(id)
}

export function countByCategory(category: CategoryKey): number {
  if (category === 'all') return TOOLS.length
  return TOOLS.filter((tool) => tool.category === category).length
}

export function filterTools(tools: Tool[], category: CategoryKey, term: string): Tool[] {
  const query = term.trim().toLowerCase()
  return tools.filter((tool) => {
    const categoryOk = category === 'all' || tool.category === category
    if (!query) return categoryOk
    const searchOk =
      tool.title.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(query))
    return categoryOk && searchOk
  })
}
