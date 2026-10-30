import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PrefsProvider } from './prefs'
import { ThemeProvider } from './theme'
import { ToolPage } from './ToolPage'
import { WorkbenchPage } from './WorkbenchPage'

export function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WorkbenchPage />} />
            <Route path="/t/:id" element={<ToolPage />} />
          </Routes>
        </BrowserRouter>
      </PrefsProvider>
    </ThemeProvider>
  )
}
