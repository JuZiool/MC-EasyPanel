import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import { Lock, Save } from 'lucide-react'

export default function SettingsPage() {
  const { addNotification } = useNotificationStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      addNotification({ type: 'error', title: '请填写所有字段' })
      return
    }
    if (newPassword.length < 6) {
      addNotification({ type: 'error', title: '新密码至少6位' })
      return
    }
    if (newPassword !== confirmPassword) {
      addNotification({ type: 'error', title: '两次密码不一致' })
      return
    }
    setLoading(true)
    const res = await apiClient.changePassword(currentPassword, newPassword)
    setLoading(false)
    if (res.success) {
      addNotification({ type: 'success', title: '密码已修改' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } else {
      addNotification({ type: 'error', title: '修改失败', message: res.message })
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">设置</h1>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">修改密码</h2>
            <p className="text-xs text-gray-400">请定期更换密码以保证账户安全</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">当前密码</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">新密码</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">确认新密码</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white rounded-lg text-sm font-medium transition-colors">
            <Save className="w-4 h-4" />{loading ? '修改中...' : '修改密码'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
