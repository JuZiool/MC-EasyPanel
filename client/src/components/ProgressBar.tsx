import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number
  status: 'pending' | 'active' | 'completed' | 'error'
  size?: 'sm' | 'md'
}

export default function ProgressBar({ progress, status, size = 'md' }: ProgressBarProps) {
  const isPending = status === 'pending'
  const isActive = status === 'active' || isPending
  const isCompleted = status === 'completed'
  const isError = status === 'error'

  const barColor = isError ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-primary-500'
  const trackColor = isError ? 'bg-red-100' : isCompleted ? 'bg-green-100' : 'bg-surface-100'
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  // 待处理状态：显示不确定进度的条纹动画
  if (isPending) {
    return (
      <div className={`w-full bg-surface-100 ${height} rounded-full overflow-hidden relative`}>
        <motion.div
          className={`absolute inset-0 ${barColor} ${height} rounded-full`}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '40%' }}
        />
      </div>
    )
  }

  return (
    <div className={`w-full ${trackColor} ${height} rounded-full overflow-hidden`}>
      <motion.div
        className={`${barColor} ${height} rounded-full relative`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* 活跃进度条右侧有微弱光晕 */}
        {isActive && progress > 0 && progress < 100 && (
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/30 rounded-full"
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  )
}
