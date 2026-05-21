import ConfirmDialog from './ConfirmDialog'

import React from 'react'

interface Props { isOpen: boolean; onClose: () => void; onConfirm: () => void; name: string; type?: string; children?: React.ReactNode }

export default function ConfirmDeleteDialog({ isOpen, onClose, onConfirm, name, type = '实例', children }: Props) {
  return <ConfirmDialog isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} title={`删除${type}`} message={`确定要删除「${name}」吗？此操作不可撤销。`} confirmText="删除" danger>{children}</ConfirmDialog>
}
