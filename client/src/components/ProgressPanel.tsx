import { motion, AnimatePresence } from 'framer-motion'
import { useProgressStore } from '../stores/progressStore'
import { X, CheckCircle, XCircle, Loader2, Archive, Download, Upload, Copy } from 'lucide-react'
import ProgressBar from './ProgressBar'

const typeIcons: Record<string, React.ElementType> = {
  upload: Upload, download: Download, compress: Archive, extract: Archive, copy: Copy, move: Copy,
}

export default function ProgressPanel() {
  const { items, removeItem } = useProgressStore()

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full">
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white rounded-xl shadow-lg border border-surface-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">文件操作</span>
              <span className="text-xs text-gray-400">{items.filter(i => i.status === 'active').length} 进行中</span>
            </div>
            {items.map((item) => {
              const Icon = typeIcons[item.type] || Loader2
              const isActive = item.status === 'active'
              const isError = item.status === 'error'
              const isCompleted = item.status === 'completed'
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isError ? 'text-red-500' : isCompleted ? 'text-green-500' : 'text-primary-500'}`} />
                      <span className="text-sm text-gray-700 truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <span className="text-xs text-gray-400 font-mono">{item.progress}%</span>
                      )}
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      {isError && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <ProgressBar progress={item.progress} status={item.status} size="sm" />
                  {item.subLabel && (
                    <p className="text-xs text-gray-400">{item.subLabel}</p>
                  )}
                  {isError && item.error && (
                    <p className="text-xs text-red-500 truncate">{item.error}</p>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
