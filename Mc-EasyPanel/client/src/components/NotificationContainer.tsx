import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '../stores/notificationStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const icons: Record<string, React.ElementType> = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const colors: Record<string, string> = { success: 'bg-green-50 border-green-200 text-green-700', error: 'bg-red-50 border-red-200 text-red-700', warning: 'bg-yellow-50 border-yellow-200 text-yellow-700', info: 'bg-blue-50 border-blue-200 text-blue-700' }
const iconColors: Record<string, string> = { success: 'text-green-500', error: 'text-red-500', warning: 'text-yellow-500', info: 'text-blue-500' }

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationStore()
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.map(n => {
          const Icon = icons[n.type]
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: 50, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-sm ${colors[n.type]}`}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColors[n.type]}`} />
              <div className="flex-1 min-w-0"><p className="font-medium text-sm">{n.title}</p>{n.message && <p className="text-xs mt-0.5 opacity-80">{n.message}</p>}</div>
              <button onClick={() => removeNotification(n.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
