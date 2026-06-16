import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, File, X, AlertCircle } from 'lucide-react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (files: File[]) => Promise<void>
}

export default function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const reset = useCallback(() => {
    setSelectedFiles([])
    setDragOver(false)
    setUploading(false)
  }, [])

  const handleClose = useCallback(() => {
    if (uploading) return
    reset()
    onClose()
  }, [uploading, reset, onClose])

  // 点击外部区域关闭
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, handleClose])

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    dragCounterRef.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)])
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
  }

  const handleUploadClick = async () => {
    if (selectedFiles.length === 0 || uploading) return
    setUploading(true)
    try {
      await onUpload(selectedFiles)
      reset()
      onClose()
    } catch {
      // 错误由上层处理
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-lg overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h3 className="text-lg font-semibold text-gray-800">上传文件</h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-surface-100 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 拖拽区域 */}
        <div className="px-6 pb-4">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-200
              ${dragOver
                ? 'border-primary-400 bg-primary-50/50 scale-[1.02]'
                : 'border-surface-300 hover:border-primary-300 hover:bg-surface-50'
              }
              ${selectedFiles.length > 0 ? 'pb-4' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className={`flex flex-col items-center gap-2 ${selectedFiles.length > 0 ? 'mb-3' : ''}`}>
              <div className={`p-3 rounded-full transition-colors ${dragOver ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-gray-400'}`}>
                <Upload className="w-6 h-6" />
              </div>
              {dragOver ? (
                <p className="text-sm font-medium text-primary-600">松开以上传文件</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-primary-500">点击选择文件</span> 或拖拽文件到此处
                  </p>
                  <p className="text-xs text-gray-400">支持所有文件类型，单个文件最大 5GB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 文件列表 */}
        {selectedFiles.length > 0 && (
          <div className="px-6 pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                已选择 {selectedFiles.length} 个文件
                <span className="text-gray-400 font-normal ml-1">
                  ({formatSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))})
                </span>
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50 group"
                >
                  <File className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatSize(file.size)}</span>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-50 border-t border-surface-200">
          {selectedFiles.length > 0 && !uploading && (
            <p className="text-xs text-gray-400">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              大文件将自动使用分片上传
            </p>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-lg transition-colors disabled:opacity-40"
            >
              取消
            </button>
            <button
              onClick={handleUploadClick}
              disabled={selectedFiles.length === 0 || uploading}
              className="flex items-center gap-2 px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始上传
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
