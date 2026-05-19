import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  height?: string
}

export default function MonacoEditor({ value, onChange, language, readOnly, height = '400px' }: Props) {
  const [code, setCode] = useState(value)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setCode(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value)
    onChange?.(e.target.value)
  }

  return (
    <div className="relative border border-surface-200 rounded-xl overflow-hidden" style={{ height }}>
      <div className="absolute top-0 left-0 right-0 bg-surface-100 px-4 py-1.5 text-xs text-gray-400 flex items-center gap-2 border-b border-surface-200 z-10">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="ml-2 text-gray-500">{language || 'text'}</span>
      </div>
      <textarea ref={textRef} value={code} onChange={handleChange} readOnly={readOnly}
        className="w-full h-full pt-8 p-4 bg-gray-900 text-green-400 font-mono text-sm leading-relaxed resize-none outline-none"
        spellCheck={false} />
    </div>
  )
}
