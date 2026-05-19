import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Server, LayoutDashboard, Globe, Terminal, FileText, Settings, Info, LogOut, Menu, ChevronLeft, ChevronRight } from 'lucide-react'

const navItems = [
  { label: '仪表盘', icon: LayoutDashboard, path: '/' },
  { label: '实例管理', icon: Server, path: '/instances' },
  { label: '文件管理', icon: FileText, path: '/files' },
  { label: '终端', icon: Terminal, path: '/terminal' },
  { label: '设置', icon: Settings, path: '/settings' },
  { label: '关于', icon: Info, path: '/about' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* 侧边栏 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-surface-200 flex flex-col transition-all ${collapsed ? 'w-16' : 'w-60'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex items-center border-b border-surface-100 ${collapsed ? 'justify-center px-0 py-4' : 'gap-3 px-5 py-4'}`}>
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0"><Globe className="w-4 h-4 text-primary-600" /></div>
          {!collapsed && <span className="font-semibold text-gray-700">Mc-EasyPanel</span>}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}
              className={({ isActive }) => `flex items-center rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-surface-50 hover:text-gray-700'}`}
              onClick={() => setSidebarOpen(false)}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-surface-100">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3 py-2'} text-sm text-gray-500`}>
            <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium shrink-0">{user?.username?.[0]}</div>
            {!collapsed && user?.username}
          </div>
          <button onClick={() => { const newState = !collapsed; setCollapsed(newState); localStorage.setItem('sidebarCollapsed', String(newState)) }} className={`flex items-center rounded-lg text-sm text-gray-400 hover:bg-surface-50 hover:text-gray-600 w-full transition-colors mt-1 ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" />折叠</>}
          </button>
          <button onClick={handleLogout} className={`flex items-center rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors mt-1 ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}>
            <LogOut className="w-4 h-4 shrink-0" />{!collapsed && '退出登录'}
          </button>
        </div>
      </aside>
      {/* 遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* 主内容 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden bg-white border-b border-surface-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500"><Menu className="w-5 h-5" /></button>
          <span className="font-semibold text-gray-700">Mc-EasyPanel</span>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
