import { useState } from 'react'
import { Banner, Checkbox, FileInput, Modal, Segmented, Select, Tabs, TextArea, stackClass } from '@/components/ui'
import { usePrefs } from './prefs'
import { useTheme } from './theme'

type SettingsDialogProps = {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const { prefs, updatePrefs } = usePrefs()
  const [fileError, setFileError] = useState<string | null>(null)

  return (
    <Modal open={open} title="工作台設定" onClose={onClose}>
      <Tabs
        label="設定分類"
        tabs={[
          {
            id: 'appearance',
            label: '外觀',
            content: (
              <Segmented
                label="色彩模式"
                value={theme}
                options={[
                  { value: 'light', label: '淺色' },
                  { value: 'dark', label: '深色' },
                ]}
                onChange={(value) => {
                  if (value === 'light' || value === 'dark') setTheme(value)
                }}
              />
            ),
          },
          {
            id: 'list',
            label: '清單',
            content: (
              <div className={stackClass}>
                <Select
                  label="排序"
                  value={prefs.sort}
                  options={[
                    { value: 'registry', label: '登記順序' },
                    { value: 'name', label: '名稱' },
                  ]}
                  onChange={(event) => {
                    updatePrefs({ sort: event.target.value === 'name' ? 'name' : 'registry' })
                  }}
                />
                <Checkbox
                  label="顯示一行說明"
                  checked={prefs.showDescription}
                  onChange={(event) => updatePrefs({ showDescription: event.target.checked })}
                />
              </div>
            ),
          },
          {
            id: 'note',
            label: '備註',
            content: (
              <div className={stackClass}>
                <TextArea
                  label="本機備註"
                  hint="只保存在這台裝置，不會上傳。"
                  rows={5}
                  value={prefs.note}
                  onChange={(event) => updatePrefs({ note: event.target.value })}
                />
                <FileInput
                  label="從文字檔讀入"
                  accept=".txt,text/plain"
                  hint="會取代目前備註。"
                  onFiles={(files) => {
                    const file = files[0]
                    if (!file) return
                    void file.text().then(
                      (note) => {
                        setFileError(null)
                        updatePrefs({ note })
                      },
                      () => setFileError('無法讀取這個檔案。'),
                    )
                  }}
                />
                {fileError ? <Banner tone="danger">{fileError}</Banner> : null}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  )
}
