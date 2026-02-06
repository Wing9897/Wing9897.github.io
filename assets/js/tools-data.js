/* ========================================
   Wing9897 Tools Hub - Tool Registry
   ======================================== */

const TOOLS = [
    {
        id: 'batch-http-advanced',
        title: '批量HTTP請求器 (進階版)',
        category: 'api',
        categoryLabel: 'API工具',
        description: '支援複雜雙層循環參數的進階API批量發送工具，具備完整的UI優化和智能滾動功能，適合大規模API測試。',
        icon: 'bi-arrow-repeat',
        tags: ['雙層循環', '批量處理', '進階UI'],
        href: 'Batch_HttpRequest(Double_loop_v2).html',
        isNew: false
    },
    {
        id: 'batch-http-standard',
        title: '批量HTTP請求器 (標準版)',
        category: 'api',
        categoryLabel: 'API工具',
        description: '簡潔高效的API批量發送工具，支援多重循環參數設定，適合日常API測試和自動化任務。',
        icon: 'bi-send',
        tags: ['多重循環', '自動化', '簡潔介面'],
        href: 'Batch_HttpRequest(Double_loop).html',
        isNew: false
    },
    {
        id: 'batch-http-qrcode',
        title: '批量HTTP請求器 (QR碼版)',
        category: 'api',
        categoryLabel: 'API工具',
        description: '結合QR碼掃描與批量API請求的創新工具，可讀取QR碼內容作為參數，配合TSV數據批量處理。',
        icon: 'bi-qr-code-scan',
        tags: ['QR碼掃描', '參數化', '批量處理'],
        href: 'Batch_HttpRequest(QRCodeWithTSV_Value).html',
        isNew: false
    },
    {
        id: 'batch-http-tsv',
        title: '批量HTTP請求器 (TSV版)',
        category: 'api',
        categoryLabel: 'API工具',
        description: '支援TSV格式數據的通用批量HTTP請求工具，為每個數據行自動生成獨立請求，適合數據遷移和批量操作。',
        icon: 'bi-table',
        tags: ['TSV格式', '數據遷移', '批量操作'],
        href: 'Batch_HttpRequest(TSV_Value).html',
        isNew: false
    },
    {
        id: 'stock-downloader',
        title: '股票數據下載器',
        category: 'data',
        categoryLabel: '數據工具',
        description: '一個用於下載股票市場數據的工具，支援多種數據源和格式。',
        icon: 'bi-graph-down-arrow',
        tags: ['股票', '數據下載', 'CSV'],
        href: 'stock_downloader.html',
        isNew: false
    },
    {
        id: 'qr-scanner-single',
        title: '實時單參數QR Code匹配器',
        category: 'scanner',
        categoryLabel: '掃描工具',
        description: '即時掃描QR碼並提供文字搜索功能，可快速從多個QR碼中找出包含特定內容的目標，支援高亮顯示。',
        icon: 'bi-upc-scan',
        tags: ['即時掃描', '文字搜索', '高亮顯示'],
        href: 'RealTimeQRMatchScanner(Singal_Value).html',
        isNew: false
    },
    {
        id: 'qr-scanner-keyvalue',
        title: '實時鍵值對QR Code匹配器',
        category: 'scanner',
        categoryLabel: '掃描工具',
        description: '支援鍵值對格式的QR碼掃描工具，可即時匹配掃描結果與預設的鍵值對數據，適合複雜的資料對應需求。',
        icon: 'bi-key',
        tags: ['鍵值對', '即時匹配', '複雜對應'],
        href: 'RealTimeQRMatchScanner(KeyValue).html',
        isNew: false
    },
    {
        id: 'qr-scanner-batch-tsv',
        title: 'Excel風格QR碼映射工具',
        category: 'scanner',
        categoryLabel: '掃描工具',
        description: '仿Excel介面的QR碼對照工具，支援批量TSV數據導入，掃描後即時顯示對應數值，適合庫存管理和資料比對。',
        icon: 'bi-file-earmark-spreadsheet',
        tags: ['Excel風格', '批量導入', '即時匹配'],
        href: 'RealTimeQRMatchScanner(Batch_TSV).html',
        isNew: false
    },
    {
        id: 'sqlite-chart-chartjs',
        title: 'SQLite Chart Viewer (Chart.js)',
        category: 'chart',
        categoryLabel: '圖表工具',
        description: '基於Chart.js的輕量級SQLite數據圖表生成工具，簡潔高效，適合快速生成基本圖表分析。',
        icon: 'bi-bar-chart-line',
        tags: ['Chart.js', '輕量級', '快速分析'],
        href: 'SQLite_to_charts(charts.js).html',
        isNew: false
    },
    {
        id: 'sqlite-chart-echarts',
        title: 'SQLite Chart Viewer (ECharts)',
        category: 'chart',
        categoryLabel: '圖表工具',
        description: '使用ECharts函式庫的SQLite數據可視化工具，支援多種圖表類型，提供豐富的交互功能和美觀的圖表效果。',
        icon: 'bi-pie-chart',
        tags: ['ECharts', 'SQLite', '數據可視化'],
        href: 'SQLite_to_charts(echarts.js).html',
        isNew: false
    },
    {
        id: 'tsv-excel-charts',
        title: 'TSV / Excel 圖表產生器',
        category: 'chart',
        categoryLabel: '圖表工具',
        description: '支援TSV和Excel格式的通用圖表生成工具，可直接導入表格數據並生成多種類型的可視化圖表。',
        icon: 'bi-graph-up',
        tags: ['TSV/Excel', '通用格式', '多種圖表'],
        href: 'TSV_Excel_to_charts.html',
        isNew: false
    },
    {
        id: 'metamask-testnet',
        title: 'MetaMask 測試交易平台',
        category: 'crypto',
        categoryLabel: '區塊鏈工具',
        description: '專業的MetaMask區塊鏈測試平台，支援多種測試網絡，提供完整的加密貨幣開發和測試環境。',
        icon: 'bi-shield-lock',
        tags: ['MetaMask', '測試網絡', '區塊鏈'],
        href: 'MetaMask_Crypto_Testnet_Platform.html',
        isNew: false
    },
    {
        id: 'phantom-solana-testnet',
        title: 'Phantom Solana 測試平台',
        category: 'crypto',
        categoryLabel: '區塊鏈工具',
        description: '專業的Phantom區塊鏈測試平台，支援Solana測試網絡，提供完整的加密貨幣開發和測試環境。',
        icon: 'bi-shield-check',
        tags: ['Phantom', 'Solana', '區塊鏈'],
        href: 'Phantom_Solana_Testnet_Platform.html',
        isNew: false
    },
    {
        id: 'blockchain-list',
        title: '區塊鏈項目列表',
        category: 'crypto',
        categoryLabel: '區塊鏈工具',
        description: '完整的區塊鏈項目列表，提供各種區塊鏈項目的詳細資訊和圖標，方便查看和了解不同的區塊鏈生態系統。',
        icon: 'bi-list-columns-reverse',
        tags: ['Blockchain', '項目列表', '生態系統'],
        href: 'blockchain_list.html',
        isNew: false
    },
    {
        id: 'crypto-binance',
        title: 'Binance 加密貨幣數據爬蟲',
        category: 'crypto',
        categoryLabel: '區塊鏈工具',
        description: '從Binance交易所獲取加密貨幣市場數據的爬蟲工具，支援即時價格、交易量等數據抓取與分析。',
        icon: 'bi-currency-bitcoin',
        tags: ['Binance', '數據爬蟲', '市場數據'],
        href: 'crypto_binance.html',
        isNew: true
    },
    {
        id: 'crypto-coinbase',
        title: 'Coinbase 加密貨幣數據爬蟲',
        category: 'crypto',
        categoryLabel: '區塊鏈工具',
        description: '從Coinbase交易所獲取加密貨幣市場數據的爬蟲工具，支援即時價格、交易量等數據抓取與分析。',
        icon: 'bi-coin',
        tags: ['Coinbase', '數據爬蟲', '市場數據'],
        href: 'crypto_coinbase.html',
        isNew: true
    },
    {
        id: 'paint-tool',
        title: '圖像處理工具',
        category: 'image',
        categoryLabel: '圖像工具',
        description: '功能豐富的圖像處理工具，支援多種圖像編輯和處理功能，提供專業的圖像處理解決方案。',
        icon: 'bi-palette',
        tags: ['圖像編輯', '圖像處理', '專業工具'],
        href: 'paint.html',
        isNew: false
    },
    {
        id: 'web3-signature',
        title: 'Web3 多鏈錢包簽名工具',
        category: 'security',
        categoryLabel: '安全工具',
        description: '支援多條區塊鏈的Web3錢包簽名驗證工具，可進行訊息簽名、驗證簽名等操作，適合DApp開發測試。',
        icon: 'bi-pen',
        tags: ['Web3', '錢包簽名', '多鏈支援'],
        href: 'web3_signature.html',
        isNew: true
    },
    {
        id: 'jwt-generator',
        title: 'JWT Token 生成器',
        category: 'security',
        categoryLabel: '安全工具',
        description: 'JSON Web Token生成與解析工具，支援多種演算法，可自訂Payload和Header，適合API認證開發測試。',
        icon: 'bi-file-earmark-lock',
        tags: ['JWT', 'Token', 'API認證'],
        href: 'jwt_generator.html',
        isNew: true
    }
];

const CATEGORIES = [
    { key: 'all', label: '全部工具' },
    { key: 'api', label: 'API工具' },
    { key: 'scanner', label: '掃描工具' },
    { key: 'chart', label: '圖表工具' },
    { key: 'crypto', label: '區塊鏈工具' },
    { key: 'image', label: '圖像工具' },
    { key: 'data', label: '數據工具' },
    { key: 'security', label: '安全工具' }
];
