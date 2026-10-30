import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, Settings, X } from 'lucide-react'
import { Banner, Button, Field, IconButton, Modal } from '@/components/ui'
import { classes } from '@/components/ui/classes'
import {
  CATEGORIES,
  TOOLS,
  accentFor,
  countByCategory,
  filterTools,
  type CategoryKey,
  type Tool,
} from '@/data/tools'
import { AppShell } from './AppShell'
import { pagePadX, pageTitle, topBar } from './chrome'
import { usePrefs, type SortMode } from './prefs'
import { useRecentTools } from './recent'
import { SettingsDialog } from './SettingsDialog'
import { ThemeToggle } from './ThemeToggle'

function sortTools(tools: Tool[], sort: SortMode): Tool[] {
  if (sort !== 'name') return tools
  return [...tools].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
}

const toolGrid =
  'm-0 grid min-w-0 list-none grid-cols-1 gap-3 p-0 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]'

function ToolMark({ tool }: { tool: Tool }) {
  const accent = accentFor(tool.category)
  return (
    <span className="inline-flex shrink-0 items-center gap-2" aria-hidden>
      <span className={classes('h-9 w-1 rounded-full', accent.mark)} />
      <span
        className={classes(
          'inline-flex size-11 items-center justify-center rounded-lg text-xl leading-none',
          accent.tile,
        )}
      >
        {tool.emoji}
      </span>
    </span>
  )
}

function ToolCard({
  tool,
  showDescription,
  compact = false,
}: {
  tool: Tool
  showDescription: boolean
  compact?: boolean
}) {
  const accent = accentFor(tool.category)
  return (
    <Link
      className={classes(
        'relative flex min-h-11 min-w-0 rounded-lg border border-solid border-border bg-surface text-inherit no-underline shadow-sm hover:bg-row-hover active:bg-row-hover',
        compact ? 'items-center gap-3 px-3 py-2' : 'h-full flex-col gap-2.5 p-3.5',
      )}
      to={`/t/${tool.id}`}
    >
      <span className={classes('flex min-w-0 gap-3', compact ? 'flex-1 items-center' : 'items-start')}>
        <ToolMark tool={tool} />
        <span className="min-w-0 flex-1">
          <span className={classes('block font-semibold leading-tight', compact ? 'truncate' : 'break-words')}>
            {tool.title}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-xs">
            <span className={classes('shrink-0 rounded-full px-1.5 py-0.5 font-medium', accent.label)}>
              {tool.categoryLabel}
            </span>
            {compact && showDescription ? (
              <span className="truncate text-text-muted">{tool.description}</span>
            ) : null}
          </span>
        </span>
      </span>
      {compact ? <ChevronRight className="shrink-0 text-text-muted" size={18} aria-hidden /> : null}
      {!compact && showDescription ? (
        <span className="line-clamp-1 text-sm leading-normal text-text-muted">{tool.description}</span>
      ) : null}
      {!compact ? (
        <span className="mt-auto inline-flex items-center gap-0.5 pt-0.5 text-sm font-medium text-text-muted">
          開啟
          <ChevronRight size={16} aria-hidden />
        </span>
      ) : (
        <span className="sr-only">開啟</span>
      )}
    </Link>
  )
}

function ToolCards({
  label,
  tools,
  showDescription,
  compact = false,
}: {
  label: string
  tools: Tool[]
  showDescription: boolean
  compact?: boolean
}) {
  return (
    <ul className={compact ? 'm-0 grid min-w-0 list-none grid-cols-1 gap-2 p-0 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]' : toolGrid} aria-label={label}>
      {tools.map((tool) => (
        <li key={tool.id} className="min-w-0">
          <ToolCard tool={tool} showDescription={showDescription} compact={compact} />
        </li>
      ))}
    </ul>
  )
}

function CategoryControls({
  variant,
  category,
  onSelect,
}: {
  variant: 'nav' | 'chip'
  category: CategoryKey
  onSelect: (key: CategoryKey) => void
}) {
  return CATEGORIES.map((item) => {
    const active = category === item.key
    const accent = accentFor(item.key)
    const nav = variant === 'nav'
    return (
      <button
        key={item.key}
        type="button"
        aria-pressed={active}
        onClick={() => onSelect(item.key)}
        className={classes(
          'inline-flex min-h-11 cursor-pointer items-center gap-2 border border-solid font-medium leading-tight',
          nav ? 'w-full justify-between rounded-md px-3 text-left text-md' : 'shrink-0 rounded-full px-3.5 text-sm',
          active ? (nav ? accent.navActive : accent.chipActive) : nav ? accent.navIdle : accent.chipIdle,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={classes(nav ? 'h-5 w-1 shrink-0 rounded-full' : 'size-2.5 shrink-0 rounded-full', accent.mark)}
          />
          <span className="truncate">{item.label}</span>
        </span>
        <span className="shrink-0 text-xs font-normal tabular-nums">{countByCategory(item.key)}</span>
      </button>
    )
  })
}

export function WorkbenchPage() {
  const { prefs } = usePrefs()
  const { tools: recentTools, clear } = useRecentTools()
  const [category, setCategory] = useState<CategoryKey>('all')
  const [term, setTerm] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    document.title = '工作台'
  }, [])

  const listed = sortTools(filterTools(TOOLS, category, term), prefs.sort)
  const activeCategory = CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[0]

  return (
    <AppShell>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] bg-bg md:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
        <header
          className={`${topBar} col-span-full flex justify-between pr-[calc(0.75rem+env(safe-area-inset-right))] pl-[calc(1rem+env(safe-area-inset-left))]`}
        >
          <h1 className={pageTitle}>工作台</h1>
          <div className="flex items-center gap-1">
            <IconButton label="工作台設定" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} aria-hidden />
            </IconButton>
            <ThemeToggle />
          </div>
        </header>

        <aside className="hidden min-h-0 overflow-auto border-r border-solid border-border bg-surface pt-4 pr-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[calc(0.75rem+env(safe-area-inset-left))] md:block">
          <p className="mx-3 mt-1 mb-2 text-xs font-semibold text-text-muted">分類</p>
          <nav className="flex flex-col gap-1" aria-label="工具分類">
            <CategoryControls variant="nav" category={category} onSelect={setCategory} />
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-bg">
          <div className={`min-w-0 pt-3 pb-2 md:pt-4 md:pb-3 ${pagePadX}`}>
            <Field
              className="w-full"
              label="搜尋工具"
              hideLabel
              placeholder="搜尋名稱、說明或標籤"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              icon={<Search size={16} aria-hidden />}
              trailing={
                term ? (
                  <IconButton
                    className="max-md:!size-10"
                    label="清除搜尋"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setTerm('')
                    }}
                  >
                    <X size={16} aria-hidden />
                  </IconButton>
                ) : null
              }
            />

            <div
              className="-mx-4 mt-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
              role="group"
              aria-label="工具分類"
            >
              <CategoryControls variant="chip" category={category} onSelect={setCategory} />
            </div>
          </div>

          <div
            className={`min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain pt-0 pb-[calc(2rem+env(safe-area-inset-bottom))] ${pagePadX}`}
          >
            {recentTools.length > 0 ? (
              <section className="rounded-lg bg-surface-2 p-3 md:p-4" aria-label="最近使用">
                <div className="mb-2 flex min-h-control items-center justify-between gap-3">
                  <h2 className="m-0 text-sm font-semibold text-text-muted">最近使用</h2>
                  <Button variant="ghost" onClick={() => setConfirmClear(true)}>
                    清除
                  </Button>
                </div>
                <ToolCards
                  label="最近使用"
                  tools={recentTools}
                  showDescription={prefs.showDescription}
                  compact
                />
              </section>
            ) : null}

            <section className="mt-6 first:mt-0">
              <h2 className="sr-only">{activeCategory?.label ?? '工具'}</h2>
              {listed.length === 0 ? (
                <Banner>沒有符合的工具。</Banner>
              ) : (
                <ToolCards label="工具清單" tools={listed} showDescription={prefs.showDescription} />
              )}
            </section>
          </div>
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Modal
        open={confirmClear}
        title="清除最近使用"
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clear()
                setConfirmClear(false)
              }}
            >
              清除
            </Button>
          </>
        }
      >
        <p>會從這台裝置移除最近開啟的工具紀錄。</p>
      </Modal>
    </AppShell>
  )
}
