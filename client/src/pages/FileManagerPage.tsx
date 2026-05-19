import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFileStore } from '../stores/fileStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useProgressStore } from '../stores/progressStore'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../utils/api'
import socketClient from '../utils/socket'
import MonacoEditor from '../components/MonacoEditor'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import ProgressPanel from '../components/ProgressPanel'
import { ArrowLeft, Upload, FilePlus, FolderPlus, RefreshCw, Download, Edit3, Trash2, FileText, Folder, Copy, Scissors, Edit, FileArchive, CheckSquare, Square, Link, Search, X } from 'lucide-react'

interface ContextMenu {
  x: number; y: number; file: { path: string; name: string; type: 'file' | 'directory' }
}

let opCounter = 0
function genOpId() { return `op_${Date.now()}_${++opCounter}` }

export default function FileManagerPage() {
  const [searchParams] = useSearchParams()
  const { currentPath, files, pagination, loading, fetchFiles } = useFileStore()
  const { addNotification } = useNotificationStore()
  const { addItem, updateItem, removeItem } = useProgressStore()
  const [editFile, setEditFile] = useState<{ path: string; content: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewDir, setShowNewDir] = useState(false)
  const [newName, setNewName] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [copyMoveTarget, setCopyMoveTarget] = useState<{ path: string; name: string; action: 'copy' | 'move' } | null>(null)
  const [copyMoveDest, setCopyMoveDest] = useState('')
  const [compressExtract, setCompressExtract] = useState<{ path: string; name: string; mode: 'compress' | 'extract'; destPath?: string } | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [batchDelete, setBatchDelete] = useState(false)
  const [clipboard, setClipboard] = useState<{ paths: string[]; action: 'copy' | 'cut' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ name: string; path: string; type: 'file' | 'directory'; size: number; modified: string }[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const pathParam = searchParams.get('path') || '/app/servers'
    fetchFiles(pathParam)
    const token = useAuthStore.getState().token
    if (token) socketClient.initialize(token)
  }, [])

  useEffect(() => { setSelectedPaths(new Set()) }, [files])

  const toggleSelect = (filePath: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath); else next.add(filePath)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedPaths.size === files.length) setSelectedPaths(new Set())
    else setSelectedPaths(new Set(files.map(f => f.path)))
  }

  const handleBatchDelete = async () => {
    for (const p of selectedPaths) await apiClient.deleteFile(p)
    addNotification({ type: 'success', title: `已删除 ${selectedPaths.size} 项` })
    setSelectedPaths(new Set()); setBatchDelete(false); fetchFiles(currentPath)
  }

  const handleBatchCompress = async () => {
    if (selectedPaths.size === 0) return
    const paths = Array.from(selectedPaths)
    const opId = genOpId()
    const socketId = socketClient.getSocketId() || undefined
    addItem({ id: opId, type: 'compress', label: '批量压缩...', progress: 0, status: 'active' })
    if (paths.length === 1) {
      const res = await apiClient.compressFile(paths[0], opId, socketId)
      if (res.success) {
        updateItem(opId, { progress: 100, status: 'completed', label: '批量压缩完成', subLabel: (res.data as any)?.name })
        addNotification({ type: 'success', title: '已压缩', message: (res.data as any)?.name })
      } else {
        updateItem(opId, { status: 'error', label: '压缩失败', error: res.message })
        addNotification({ type: 'error', title: '压缩失败' })
      }
    } else {
      const res = await apiClient.compressBatch(paths, 'selection.zip', opId, socketId)
      if (res.success) {
        updateItem(opId, { progress: 100, status: 'completed', label: '批量压缩完成', subLabel: 'selection.zip' })
        addNotification({ type: 'success', title: '已批量压缩', message: 'selection.zip' })
      } else {
        updateItem(opId, { status: 'error', label: '批量压缩失败', error: res.message })
        addNotification({ type: 'error', title: '压缩失败' })
      }
    }
    setSelectedPaths(new Set()); fetchFiles(currentPath)
    setTimeout(() => removeItem(opId), 3000)
  }

  const handleCopyToClipboard = (action: 'copy' | 'cut') => {
    setClipboard({ paths: Array.from(selectedPaths), action })
    addNotification({ type: 'info', title: `已${action === 'copy' ? '复制' : '剪切'} ${selectedPaths.size} 项到剪贴板` })
    setSelectedPaths(new Set())
  }

  const handlePaste = async () => {
    if (!clipboard || !currentPath) return
    const socketId = socketClient.getSocketId() || undefined
    for (const srcPath of clipboard.paths) {
      const name = srcPath.split('/').pop() || ''
      const destPath = currentPath + '/' + name
      const opId = genOpId()
      if (clipboard.action === 'copy') {
        addItem({ id: opId, type: 'copy', label: `复制: ${name}`, progress: 0, status: 'active' })
        const res = await apiClient.copyFile(srcPath, destPath, opId, socketId)
        if (res.success) updateItem(opId, { progress: 100, status: 'completed', label: `复制完成: ${name}` })
        else updateItem(opId, { status: 'error', label: `复制失败: ${name}`, error: res.message })
        setTimeout(() => removeItem(opId), 3000)
      } else {
        await apiClient.moveFile(srcPath, destPath)
      }
    }
    addNotification({ type: 'success', title: `已${clipboard.action === 'copy' ? '复制' : '移动'} ${clipboard.paths.length} 项到当前目录` })
    setClipboard(null)
    fetchFiles(currentPath)
  }

  const navigateDir = (dirPath: string) => { clearSearch(); fetchFiles(dirPath) }
  const goUp = () => { const parent = currentPath.split('/').slice(0, -1).join('/') || '/'; fetchFiles(parent) }

  const handleReadFile = async (filePath: string, fileName: string) => {
    const res = await apiClient.readFile(filePath)
    if (res.success && res.data) setEditFile({ path: filePath, content: res.data.content, name: fileName })
    else addNotification({ type: 'error', title: '读取失败', message: res.message })
  }

  const handleSaveFile = async () => {
    if (!editFile) return
    const res = await apiClient.saveFile(editFile.path, editFile.content)
    if (res.success) { addNotification({ type: 'success', title: '保存成功' }); setEditFile(null) }
    else addNotification({ type: 'error', title: '保存失败' })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await apiClient.deleteFile(deleteTarget.path)
    if (res.success) { addNotification({ type: 'success', title: '已删除' }); fetchFiles(currentPath) }
    else addNotification({ type: 'error', title: '删除失败' })
    setDeleteTarget(null)
  }

  const handleCreateFile = async () => {
    if (!newName.trim()) return
    const filePath = `${currentPath}/${newName}`
    const res = await apiClient.saveFile(filePath, '')
    if (res.success) { addNotification({ type: 'success', title: '已创建' }); fetchFiles(currentPath); setShowNewFile(false); setNewName('') }
    else addNotification({ type: 'error', title: '创建失败' })
  }

  const handleCreateDir = async () => {
    if (!newName.trim()) return
    const dirPath = `${currentPath}/${newName}`
    const res = await apiClient.createDirectory(dirPath)
    if (res.success) { addNotification({ type: 'success', title: '已创建' }); fetchFiles(currentPath); setShowNewDir(false); setNewName('') }
    else addNotification({ type: 'error', title: '创建失败' })
  }

  useEffect(() => {
    const onClick = () => setContextMenu(null)
    if (contextMenu) { document.addEventListener('click', onClick); return () => document.removeEventListener('click', onClick) }
  }, [contextMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent, file: ContextMenu['file']) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    const parentDir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'))
    const newPath = `${parentDir}/${renameValue.trim()}`
    const res = await apiClient.renameFile(renameTarget.path, newPath)
    if (res.success) { addNotification({ type: 'success', title: '已重命名' }); fetchFiles(currentPath) }
    else addNotification({ type: 'error', title: '重命名失败' })
    setRenameTarget(null); setRenameValue('')
  }

  const handleCopyMove = async () => {
    if (!copyMoveTarget || !copyMoveDest.trim()) return
    const destPath = copyMoveDest.trim().endsWith('/') ? copyMoveDest.trim() + copyMoveTarget.name : copyMoveDest.trim()
    if (copyMoveTarget.action === 'copy') {
      const opId = genOpId()
      const socketId = socketClient.getSocketId() || undefined
      addItem({ id: opId, type: 'copy', label: `复制: ${copyMoveTarget.name}`, progress: 0, status: 'active' })
      const res = await apiClient.copyFile(copyMoveTarget.path, destPath, opId, socketId)
      if (res.success) {
        updateItem(opId, { progress: 100, status: 'completed', label: `复制完成: ${copyMoveTarget.name}` })
        addNotification({ type: 'success', title: '已复制' })
      } else {
        updateItem(opId, { status: 'error', label: `复制失败: ${copyMoveTarget.name}`, error: res.message })
        addNotification({ type: 'error', title: '复制失败' })
      }
      setTimeout(() => removeItem(opId), 3000)
    } else {
      const res = await apiClient.moveFile(copyMoveTarget.path, destPath)
      if (res.success) addNotification({ type: 'success', title: '已移动' })
      else addNotification({ type: 'error', title: '移动失败' })
    }
    fetchFiles(currentPath)
    setCopyMoveTarget(null); setCopyMoveDest('')
  }

  const handleCompress = async () => {
    if (!compressExtract) return
    const opId = genOpId()
    const socketId = socketClient.getSocketId() || undefined
    addItem({ id: opId, type: 'compress', label: `压缩: ${compressExtract.name}`, progress: 0, status: 'active' })
    const res = await apiClient.compressFile(compressExtract.path, opId, socketId)
    if (res.success) {
      updateItem(opId, { progress: 100, status: 'completed', label: `压缩完成: ${compressExtract.name}`, subLabel: (res.data as any)?.name })
      addNotification({ type: 'success', title: '已压缩', message: (res.data as any)?.name })
    } else {
      updateItem(opId, { status: 'error', label: '压缩失败', error: res.message })
      addNotification({ type: 'error', title: '压缩失败' })
    }
    setCompressExtract(null)
    fetchFiles(currentPath)
    setTimeout(() => removeItem(opId), 3000)
  }

  const handleExtract = async () => {
    if (!compressExtract) return
    const opId = genOpId()
    const socketId = socketClient.getSocketId() || undefined
    addItem({ id: opId, type: 'extract', label: `解压: ${compressExtract.name}`, progress: 0, status: 'active' })
    const res = await apiClient.extractFile(compressExtract.path, opId, socketId, compressExtract.destPath || undefined)
    if (res.success) {
      updateItem(opId, { progress: 100, status: 'completed', label: `解压完成: ${compressExtract.name}` })
      addNotification({ type: 'success', title: '已解压' })
    } else {
      updateItem(opId, { status: 'error', label: '解压失败', error: res.message })
      addNotification({ type: 'error', title: '解压失败' })
    }
    setCompressExtract(null)
    fetchFiles(currentPath)
    setTimeout(() => removeItem(opId), 3000)
  }

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults(null); return }
    if (!currentPath) return
    setSearching(true)
    const res = await apiClient.searchFiles(currentPath, query.trim())
    if (res.success && res.data) setSearchResults(res.data)
    else setSearchResults([])
    setSearching(false)
  }, [currentPath])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const timer = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, doSearch])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const opId = genOpId()
    const fileNames = Array.from(files).map(f => f.name).join(', ')
    addItem({ id: opId, type: 'upload', label: `上传中...`, subLabel: fileNames, progress: 0, status: 'active' })
    const res = await apiClient.uploadFiles(currentPath, files, (p) => {
      updateItem(opId, { progress: p, subLabel: `${fileNames} (${p}%)` })
    })
    if (res.success) {
      updateItem(opId, { progress: 100, status: 'completed', label: '上传完成' })
      addNotification({ type: 'success', title: '上传成功' })
    } else {
      updateItem(opId, { status: 'error', label: '上传失败', error: res.message })
      addNotification({ type: 'error', title: '上传失败' })
    }
    fetchFiles(currentPath)
    e.target.value = ''
    setTimeout(() => removeItem(opId), 3000)
  }

  const handleDownload = async (filePath: string, fileName: string) => {
    const opId = genOpId()
    addItem({ id: opId, type: 'download', label: `下载: ${fileName}`, progress: 0, status: 'active' })
    const res = await apiClient.downloadFile(filePath, fileName, (p) => {
      updateItem(opId, { progress: p, subLabel: `${p}%` })
    })
    if (res.success) {
      updateItem(opId, { progress: 100, status: 'completed', label: `下载完成: ${fileName}` })
    } else {
      updateItem(opId, { status: 'error', label: `下载失败: ${fileName}`, error: res.message })
      addNotification({ type: 'error', title: '下载失败' })
    }
    setTimeout(() => removeItem(opId), 3000)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  return (
    <div className="flex flex-col h-full -m-4 lg:-m-6">
      <div className="shrink-0 px-4 lg:px-6 pt-4 lg:pt-6 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">文件管理</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchFiles(currentPath)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-100 transition-colors" title="刷新"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowNewFile(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><FilePlus className="w-4 h-4" />新建文件</button>
            <button onClick={() => setShowNewDir(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><FolderPlus className="w-4 h-4" />新建目录</button>
            <label className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />上传
              <input type="file" multiple className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <button onClick={goUp} className="p-1 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></button>
          <span className="font-mono text-xs bg-surface-100 px-3 py-1.5 rounded-lg">{currentPath || '/'}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索文件或文件夹..."
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 lg:px-6 pb-4">
      {(() => {
        const isSearching = searchResults !== null
        const displayFiles = isSearching ? searchResults || [] : files
        const displayLoading = loading || searching

        if (displayLoading) return <div className="text-center py-10 text-gray-400">{searching ? '搜索中...' : '加载中...'}</div>
        return (
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-surface-50 border-b border-surface-200 text-xs text-gray-500 font-medium">
            {isSearching ? (
              <span className="flex-1">搜索结果 ({displayFiles.length} 项)</span>
            ) : (
              <>
              <button onClick={toggleSelectAll} className="shrink-0 text-gray-400 hover:text-primary-500 transition-colors">
                {selectedPaths.size === files.length && files.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              <span className="w-4 shrink-0" />
              <span className="flex-1">名称</span>
              <span className="w-20 text-right">大小</span>
              <span className="w-32 text-right">修改时间</span>
              <span className="w-20 text-right">操作</span>
              </>
            )}
          </div>
          {displayFiles.map((file, i) => (
            <motion.div key={file.path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              onContextMenu={(e) => handleContextMenu(e, { path: file.path, name: file.name, type: file.type })}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 last:border-0 group cursor-context-menu transition-colors ${selectedPaths.has(file.path) ? 'bg-primary-50/50' : 'hover:bg-surface-50'}`}>
              {isSearching ? (
                <span className="w-4 shrink-0" />
              ) : (
                <button onClick={() => toggleSelect(file.path)} className="shrink-0 text-gray-400 hover:text-primary-500 transition-colors">
                  {selectedPaths.has(file.path) ? <CheckSquare className="w-4 h-4 text-primary-500" /> : <Square className="w-4 h-4" />}
                </button>
              )}
              {file.type === 'directory' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileText className="w-4 h-4 text-blue-400 shrink-0" />}
              <button onClick={() => file.type === 'directory' ? navigateDir(file.path) : handleReadFile(file.path, file.name)}
                className="flex-1 text-left text-sm text-gray-700 hover:text-primary-600 truncate font-medium">
                {file.name}
              </button>
              {isSearching && (
                <span className="text-xs text-gray-400 truncate max-w-[200px] hidden sm:block font-mono">{file.path.replace(currentPath, '')}</span>
              )}
              <span className="text-xs text-gray-400 w-20 text-right shrink-0">{formatSize(file.size)}</span>
              <span className="text-xs text-gray-400 w-32 text-right shrink-0 hidden sm:block">{new Date(file.modified).toLocaleString()}</span>
              <div className="flex items-center gap-1 w-20 justify-end shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {file.type === 'file' && <button onClick={() => handleReadFile(file.path, file.name)} className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50"><Edit3 className="w-3.5 h-3.5" /></button>}
                <button onClick={() => handleDownload(file.path, file.name)} className="p-1.5 rounded text-gray-400 hover:text-green-500 hover:bg-green-50"><Download className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteTarget({ path: file.path, name: file.name })} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          ))}
          {displayFiles.length === 0 && <div className="text-center py-10 text-gray-400">{isSearching ? '未找到匹配的文件' : '目录为空'}</div>}
        </div>
        )
      })()}
      </div>

      {selectedPaths.size > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-xl shadow-lg border border-surface-200 px-4 py-3 flex items-center gap-4">
          <span className="text-sm text-gray-600">已选 {selectedPaths.size} 项</span>
          <div className="w-px h-5 bg-surface-200" />
          <button onClick={() => handleCopyToClipboard('copy')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><Copy className="w-4 h-4" />复制</button>
          <button onClick={() => handleCopyToClipboard('cut')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><Scissors className="w-4 h-4" />剪切</button>
          <button onClick={handleBatchCompress} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><FileArchive className="w-4 h-4" />压缩</button>
          <button onClick={() => setBatchDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" />删除</button>
          <button onClick={() => setSelectedPaths(new Set())} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-surface-100 rounded-lg transition-colors">取消</button>
        </motion.div>
      )}

      {clipboard && selectedPaths.size === 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-xl shadow-lg border border-primary-200 px-4 py-3 flex items-center gap-4">
          <span className="text-sm text-gray-600">剪贴板: {clipboard.paths.length} 项 (已{clipboard.action === 'copy' ? '复制' : '剪切'})</span>
          <div className="w-px h-5 bg-surface-200" />
          <button onClick={handlePaste} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Copy className="w-4 h-4" />粘贴到此处</button>
          <button onClick={() => setClipboard(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-surface-100 rounded-lg transition-colors">清除</button>
        </motion.div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchFiles(currentPath, p)}
              className={`px-3 py-1 rounded-lg text-sm ${p === pagination.page ? 'bg-primary-500 text-white' : 'bg-white border border-surface-200 text-gray-600 hover:bg-surface-50'}`}>{p}</button>
          ))}
        </div>
      )}

      {editFile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-surface-200">
              <h3 className="font-medium text-gray-800 truncate">{editFile.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveFile} className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">保存</button>
                <button onClick={() => setEditFile(null)} className="px-4 py-1.5 text-gray-500 hover:bg-surface-100 rounded-lg text-sm transition-colors">关闭</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <MonacoEditor value={editFile.content} onChange={(v) => setEditFile({ ...editFile, content: v })} language="properties" height="60vh" />
            </div>
          </div>
        </motion.div>
      )}

      {(showNewFile || showNewDir) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800">{showNewFile ? '新建文件' : '新建目录'}</h3>
            <p className="text-sm text-gray-400 mt-1">位置: {currentPath}</p>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="输入名称"
              className="w-full mt-4 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowNewFile(false); setShowNewDir(false); setNewName('') }} className="px-4 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg">取消</button>
              <button onClick={showNewFile ? handleCreateFile : handleCreateDir} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">创建</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <ConfirmDeleteDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.name || ''} type="文件" />

      <ConfirmDeleteDialog isOpen={batchDelete} onClose={() => setBatchDelete(false)} onConfirm={handleBatchDelete} name={`${selectedPaths.size} 项`} type="文件" />

      <AnimatePresence>
      {contextMenu && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-surface-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.file.type === 'directory' ? (
            <button onClick={() => { navigateDir(contextMenu.file.path); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><ArrowLeft className="w-4 h-4" />打开</button>
          ) : (
            <button onClick={() => { handleReadFile(contextMenu.file.path, contextMenu.file.name); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Edit3 className="w-4 h-4" />编辑</button>
          )}
          {contextMenu.file.type === 'file' && (
            <button onClick={() => { handleDownload(contextMenu.file.path, contextMenu.file.name); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Download className="w-4 h-4" />下载</button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(contextMenu.file.path); addNotification({ type: 'success', title: '已复制路径', message: contextMenu.file.path }); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Link className="w-4 h-4" />复制容器内路径</button>
          <button onClick={() => { setRenameTarget({ path: contextMenu.file.path, name: contextMenu.file.name }); setRenameValue(contextMenu.file.name); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Edit className="w-4 h-4" />重命名</button>
          <button onClick={() => { setCopyMoveTarget({ path: contextMenu.file.path, name: contextMenu.file.name, action: 'copy' }); setCopyMoveDest(currentPath); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Copy className="w-4 h-4" />复制</button>
          <button onClick={() => { setCopyMoveTarget({ path: contextMenu.file.path, name: contextMenu.file.name, action: 'move' }); setCopyMoveDest(currentPath); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><Scissors className="w-4 h-4" />移动</button>
          <button onClick={() => { setCompressExtract({ path: contextMenu.file.path, name: contextMenu.file.name, mode: 'compress' }); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><FileArchive className="w-4 h-4" />压缩</button>
          {contextMenu.file.name.endsWith('.zip') && (
            <button onClick={() => { setCompressExtract({ path: contextMenu.file.path, name: contextMenu.file.name, mode: 'extract', destPath: currentPath }); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-surface-50"><FileArchive className="w-4 h-4" />解压</button>
          )}
          <div className="border-t border-surface-100 my-1" />
          <button onClick={() => { setDeleteTarget({ path: contextMenu.file.path, name: contextMenu.file.name }); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />删除</button>
        </motion.div>
      )}
      </AnimatePresence>

      {renameTarget && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800">重命名</h3>
            <p className="text-sm text-gray-400 mt-1">{renameTarget.name}</p>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
              className="w-full mt-4 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setRenameTarget(null); setRenameValue('') }} className="px-4 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg">取消</button>
              <button onClick={handleRename} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">确认</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {copyMoveTarget && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800">{copyMoveTarget.action === 'copy' ? '复制' : '移动'}</h3>
            <p className="text-sm text-gray-400 mt-1">{copyMoveTarget.name} →</p>
            <input type="text" value={copyMoveDest} onChange={e => setCopyMoveDest(e.target.value)} autoFocus
              className="w-full mt-4 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700 font-mono text-sm" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setCopyMoveTarget(null); setCopyMoveDest('') }} className="px-4 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg">取消</button>
              <button onClick={handleCopyMove} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">确认</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {compressExtract && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary-100 text-primary-600"><FileArchive className="w-5 h-5" /></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{compressExtract.mode === 'compress' ? '压缩' : '解压'}</h3>
                <p className="text-sm text-gray-400">{compressExtract.name}</p>
              </div>
            </div>
            {compressExtract.mode === 'extract' && (
              <>
                <label className="block text-xs text-gray-500 mb-1">目标目录</label>
                <input type="text" value={compressExtract.destPath || ''} onChange={e => setCompressExtract({ ...compressExtract, destPath: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700 font-mono text-sm" />
              </>
            )}
            {compressExtract.mode === 'compress' && (
              <p className="text-sm text-gray-500">将在同目录创建 {compressExtract.name}.zip</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setCompressExtract(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg">取消</button>
              <button onClick={compressExtract.mode === 'compress' ? handleCompress : handleExtract}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">
                {compressExtract.mode === 'compress' ? '压缩' : '解压'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {currentPath && <button onClick={goUp} className="fixed bottom-6 right-6 w-12 h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"><ArrowLeft className="w-5 h-5" /></button>}

      <ProgressPanel />
    </div>
  )
}
