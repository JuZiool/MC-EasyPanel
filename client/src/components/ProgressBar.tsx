import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number
  status: 'pending' | 'active' | 'completed' | 'error'
  size?: 'sm' | 'md'
}

export default function ProgressBar({ progress, status, size = 'md' }: ProgressBarProps) {
  const isActive = status === 'active'
  const isCompleted = status === 'completed'
  const isError = status === 'error'

  const barColor = isError ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-primary-500'
  const trackColor = isError ? 'bg-red-100' : isCompleted ? 'bg-green-100' : 'bg-surface-100'
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className={`w-full ${trackColor} ${height} rounded-full overflow-hidden`}>
      <motion.div
        className={`${barColor} ${height} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}
