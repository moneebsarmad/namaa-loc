'use client'

import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'

interface Props {
  entity: string
  onParsed: (rows: Record<string, string>[]) => void
  templateUrl?: string
}

export function CSVUploader({ entity, onParsed, templateUrl }: Props) {
  const [filename, setFilename] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(
    (file: File) => {
      setFilename(file.name)
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          onParsed(result.data)
        },
      })
    },
    [onParsed]
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) parseFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging ? 'border-forest bg-forest/5' : 'border-gray-300 hover:border-forest/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />
        {filename ? (
          <div>
            <p className="text-forest font-medium">{filename}</p>
            <p className="text-sm text-gray-400 mt-1">Click or drag to replace</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 font-medium">Drop your {entity} CSV here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {templateUrl && (
        <a
          href={templateUrl}
          className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline font-medium"
          download
        >
          ↓ Download {entity} CSV template
        </a>
      )}
    </div>
  )
}
