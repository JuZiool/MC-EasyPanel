import ConfirmDialog from './ConfirmDialog'

interface Props { isOpen: boolean; onClose: () => void; onConfirm: () => void; name: string; type?: string }

export default function ConfirmDeleteDialog({ isOpen, onClose, onConfirm, name, type = '实例' }: Props) {
  return <ConfirmDialog isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} title={`删除${type}`} message={`确定要删除「${name}」吗？此操作不可撤销。`} confirmText="删除" danger />
}
