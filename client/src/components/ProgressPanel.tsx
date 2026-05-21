import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProgressStore } from '../stores/progressStore'
import { X, CheckCircle, XCircle, Loader2, Archive, Download, Upload, Copy, FileArchive } from 'lucide-react'
import ProgressBar from './ProgressBar'

const typeIcons: Record<string, React.ElementType> = {
  upload: Upload, download: Download, compress: Archive, extract: Archive, copy: Copy, move: Copy,
}

/** 动画点指示器——活跃状态时的脉冲 */
function PulsingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-primary-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/** 单个进度条项 — 带自动移除计时 */
function ProgressItem({
  item,
  onRemove,
}: {
  item: import('../stores/progressStore').ProgressItem
  onRemove: (id: string) => void
}) {
  const Icon = typeIcons[item.type] || Loader2
  const isActive = item.status === 'active' || item.status === 'pending'
  const isError = item.status === 'error'
  const isCompleted = item.status === 'completed'

  // 自动移除已完成/错误的项（5秒后）
  useEffect(() => {
    if (isCompleted || isError) {
      const timer = setTimeout(() => onRemove(item.id), 5000)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, isError, item.id, onRemove])

  // 进度动画数值：确保从 0 平滑过渡
  const displayProgress = isCompleted ? 100 : isError ? item.progress : item.progress

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
      className="overflow-hidden"
    >
      <div className="space-y-1.5">
        {/* 第一行：图标 + 标题 + 进度% + 关闭按钮 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isActive && item.status === 'pending' ? (
              <Icon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            ) : (
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isError ? 'text-red-500' : isCompleted ? 'text-green-500' : 'text-primary-500'}`} />
            )}
            <span className={`text-sm truncate ${isError ? 'text-red-600' : isCompleted ? 'text-green-700' : 'text-gray-700'}`}>
              {item.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isActive && (
              <span className="text-xs text-gray-400 font-mono tabular-nums min-w-[2.5rem] text-right">
                {item.progress}%
              </span>
            )}
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              </motion.div>
            )}
            {isError && <XCircle className="w-3.5 h-3.5 text-red-500" />}
            <button
              onClick={() => onRemove(item.id)}
              className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar progress={displayProgress} status={item.status} size="sm" />
          </div>
          {/* 活跃状态显示脉冲点 */}
          {isActive && <PulsingDots />}
        </div>

        {/* 副标题（当前操作详情） */}
        {item.subLabel && (
          <motion.p
            key={item.subLabel}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-gray-400 truncate flex items-center gap-1.5"
          >
            {item.status === 'active' && (
              <span className="w-1 h-1 rounded-full bg-primary-300 flex-shrink-0" />
            )}
            {item.subLabel}
          </motion.p>
        )}

        {/* 错误详情 */}
        {isError && item.error && (
          <p className="text-xs text-red-500 truncate bg-red-50 rounded px-2 py-1">{item.error}</p>
        )}

        {/* 完成时间戳 */}
        {isCompleted && (
          <p className="text-[10px] text-gray-300">刚刚完成</p>
        )}
      </div>
    </motion.div>
  )
}

export default function ProgressPanel() {
  const { items, removeItem } = useProgressStore()
  const [collapsed, setCollapsed] = useState(false)
  const hasItems = items.length > 0
  const activeCount = items.filter(i => i.status === 'active' || i.status === 'pending').length

  // 全部完成/失败后自动折叠
  useEffect(() => {
    if (items.length > 0 && activeCount === 0) {
      const timer = setTimeout(() => setCollapsed(true), 8000)
      return () => clearTimeout(timer)
    }
  }, [items.length, activeCount])

  // 有新任务时展开
  useEffect(() => {
    if (activeCount > 0 && collapsed) setCollapsed(false)
  }, [activeCount, collapsed])

  if (!hasItems) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
          className="bg-white rounded-xl shadow-lg border border-surface-200 pointer-events-auto overflow-hidden"
        >
          {/* 标题栏 — 点击可折叠 */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700">文件操作</span>
              {activeCount > 0 && (
                <motion.span
                  key={activeCount}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="text-xs bg-primary-100 text-primary-600 rounded-full px-1.5 py-0.5 font-medium min-w-[1.2rem] text-center"
                >
                  {activeCount}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {activeCount > 0
                  ? `${activeCount} 进行中`
                  : `共 ${items.length} 项`}
              </span>
              <motion.svg
                animate={{ rotate: collapsed ? 0 : 180 }}
                transition={{ duration: 0.2 }}
                className="w-3.5 h-3.5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </motion.svg>
            </div>
          </button>

          {/* 进度列表 */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3">
                  {items.map((item) => (
                    <ProgressItem key={item.id} item={item} onRemove={removeItem} />
                  ))}

                  {/* 全部完成提示 */}
                  {activeCount === 0 && items.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-gray-300 text-center pt-1"
                    >
                      所有操作已完成 · 即将自动收起
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
