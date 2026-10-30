import { Suspense, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'
import { Banner } from '@/components/ui'
import { getTool } from '@/data/tools'
import { AppShell } from './AppShell'
import { pageTitle, topBar } from './chrome'
import { rememberTool } from './recent'
import { ThemeToggle } from './ThemeToggle'

const backLink =
  'inline-flex min-h-control min-w-control items-center justify-center gap-0.5 rounded-md px-0 text-sm font-medium whitespace-nowrap text-accent-strong no-underline hover:bg-row-hover md:justify-start md:px-1'

export function ToolPage() {
  const { id } = useParams()
  const tool = id ? getTool(id) : undefined
  const View = tool?.View

  useEffect(() => {
    if (!tool) return
    rememberTool(tool.id)
  }, [tool])

  useEffect(() => {
    document.title = tool ? `${tool.title} · 工作台` : '找不到這個工具 · 工作台'
  }, [tool])

  const title = tool ? tool.title : '找不到這個工具'

  return (
    <AppShell>
      <article className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <header
          className={`${topBar} grid shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] pr-[calc(0.5rem+env(safe-area-inset-right))] pl-[calc(0.5rem+env(safe-area-inset-left))] md:grid-cols-[auto_minmax(0,1fr)_auto] md:pr-[calc(0.75rem+env(safe-area-inset-right))] md:pl-[calc(1rem+env(safe-area-inset-left))]`}
        >
          <Link className={backLink} to="/">
            <ArrowLeft size={20} aria-hidden />
            <span className="sr-only md:not-sr-only">返回工作台</span>
          </Link>
          <h1 className={`${pageTitle} truncate text-center md:px-2 md:text-left`}>{title}</h1>
          <ThemeToggle size={20} />
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain pt-3 pr-[calc(0.75rem+env(safe-area-inset-right))] pb-4 pl-[calc(0.75rem+env(safe-area-inset-left))] md:pt-6 md:pr-[calc(1.5rem+env(safe-area-inset-right))] md:pb-[calc(2rem+env(safe-area-inset-bottom))] md:pl-[calc(1.5rem+env(safe-area-inset-left))]">
          {tool ? (
            <>
              <p className="mb-4 max-w-[72ch] text-sm leading-normal text-text-muted">{tool.description}</p>
              <div className="max-w-full min-w-0 [&_canvas]:max-w-full">
                {View ? (
                  <Suspense fallback={<Banner tone="info">載入工具中…</Banner>}>
                    <View />
                  </Suspense>
                ) : (
                  <Banner tone="warning">這個工具尚未接入。</Banner>
                )}
              </div>
            </>
          ) : (
            <Banner tone="warning">沒有登記這個工具。</Banner>
          )}
        </div>
        <nav
          className="flex shrink-0 items-stretch justify-center border-t border-solid border-border bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] min-h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:hidden"
          aria-label="工具導覽"
        >
          <Link
            className="flex min-h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 px-4 pt-1 pb-0.5 text-xs font-semibold text-accent-strong no-underline active:bg-row-hover"
            to="/"
          >
            <Home size={20} aria-hidden />
            <span>工作台</span>
          </Link>
        </nav>
      </article>
    </AppShell>
  )
}
