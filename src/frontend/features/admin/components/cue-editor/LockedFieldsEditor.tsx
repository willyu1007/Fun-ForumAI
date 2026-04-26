/**
 * T-210 M2 — locked-fields editor.
 *
 * Simple chip-list of dot-paths. Admin can add a path or remove an existing
 * one. Path semantics per cue-editor-admin/02-architecture.md DEC-T210-B:
 * dot-path strings, parent locks descendants, sibling paths independent.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

export function LockedFieldsEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')

  function addPath() {
    const trimmed = draft.trim()
    if (!trimmed || value.includes(trimmed)) {
      setDraft('')
      return
    }
    onChange([...value, trimmed])
    setDraft('')
  }

  function removePath(path: string) {
    onChange(value.filter((p) => p !== path))
  }

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        锁定的字段（dot-path）。锁住父路径会同时锁住所有子路径；兄弟路径互不影响。
      </p>
      <ul className="flex flex-wrap gap-1">
        {value.length === 0 ? (
          <li className="text-muted-foreground">（未锁定任何字段）</li>
        ) : (
          value.map((path) => (
            <li key={path}>
              <Badge variant="outline" className="gap-1">
                <span className="font-mono">{path}</span>
                <button
                  type="button"
                  className="text-destructive disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => removePath(path)}
                  aria-label={`移除 ${path} 锁`}
                >
                  ×
                </button>
              </Badge>
            </li>
          ))
        )}
      </ul>
      {!disabled ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例如 scene_constraints.allowed_scene_families"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPath()
              }
            }}
          />
          <button
            type="button"
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
            onClick={addPath}
            disabled={!draft.trim()}
          >
            添加
          </button>
        </div>
      ) : null}
    </div>
  )
}
