import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean; children?: React.ReactNode }

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = '确认', cancelText = '取消', danger, children }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-gray-500 mt-2 text-sm">{message}</p>
            {children}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-surface-100 transition-colors text-sm font-medium">{cancelText}</button>
              <button onClick={() => { onConfirm(); onClose() }} className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}>{confirmText}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
