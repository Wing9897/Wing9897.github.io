export function downloadFile(data: Blob | string, filename: string, mime?: string): void {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: mime ?? 'text/plain;charset=utf-8' })
      : mime
        ? new Blob([data], { type: mime })
        : data
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
