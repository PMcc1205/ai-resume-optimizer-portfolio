import { FileText, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

type FileUploadPlaceholderProps = {
  file?: File
  error?: string
  onFileSelect: (file: File) => void
  onClear: () => void
  disabled?: boolean
}

export function FileUploadPlaceholder({ file, error, onFileSelect, onClear, disabled }: FileUploadPlaceholderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = () => inputRef.current?.click()

  const formatFileSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        aria-label="选择 PDF 简历"
        disabled={disabled}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0]
          if (selectedFile) onFileSelect(selectedFile)
          event.target.value = ''
        }}
      />
      {file ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">已选择</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">PDF  {formatFileSize(file.size)}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="min-h-9 flex-1 px-3" onClick={handleSelect} disabled={disabled}><RefreshCw className="h-4 w-4" />重新选择</Button>
            <Button variant="ghost" className="min-h-9 px-3 text-red-600 hover:bg-red-50" onClick={onClear} disabled={disabled}><Trash2 className="h-4 w-4" />移除</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={handleSelect} disabled={disabled} className={cn('group flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/80 px-6 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60', error ? 'border-red-400' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/60')}>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm"><UploadCloud className="h-5 w-5" /></span>
          <span className="font-semibold text-ink">选择 PDF 简历</span>
          <span className="mt-1.5 text-sm text-slate-500">仅支持 PDF 文件，最大 10 MB</span>
        </button>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{error}</p>}
    </div>
  )
}
