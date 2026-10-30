import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { useTheme } from './theme'

export function ThemeToggle({ size = 18 }: { size?: number }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <IconButton label={theme === 'dark' ? '切換為淺色' : '切換為深色'} onClick={toggleTheme}>
      {theme === 'dark' ? <Sun size={size} aria-hidden /> : <Moon size={size} aria-hidden />}
    </IconButton>
  )
}
