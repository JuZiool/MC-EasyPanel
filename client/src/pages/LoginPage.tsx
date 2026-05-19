import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Server, Eye, EyeOff, User, Lock } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [checking, setChecking] = useState(true)
  const { login, register, checkHasUsers, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    checkHasUsers().then((hasUsers) => {
      setIsRegister(!hasUsers)
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('请填写用户名和密码'); return }
    const success = isRegister ? await register(username, password) : await login(username, password)
    if (success) navigate('/')
    else setError(isRegister ? '注册失败，可能已有用户' : '用户名或密码错误')
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-white to-surface-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-4">
            <Server className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Mc-EasyPanel</h1>
          <p className="text-gray-500 mt-1">Minecraft 服务器管理面板</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-surface-200 p-8 space-y-5">
          <h2 className="text-lg font-medium text-gray-700">{isRegister ? '创建管理员账号' : '登录面板'}</h2>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg border border-red-100">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-700" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}
          </button>
          {!isRegister && (
            <p className="text-center text-sm text-gray-400">
              首次使用？系统将自动引导注册
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
