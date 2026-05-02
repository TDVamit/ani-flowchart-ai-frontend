import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlowchartStore } from '../store/useFlowchartStore'

export default function FlowchartList() {
  const { metas, charts, loadCharts, createChart, deleteChart, renameChart, loading } = useFlowchartStore()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => { loadCharts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    const name = newName.trim() || 'Untitled Flowchart'
    const id   = await createChart(name)
    setCreating(false)
    setNewName('')
    navigate(`/flowchart/${id}`)
  }

  function handleOpen(id: string) {
    navigate(`/flowchart/${id}`)
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this flowchart? This cannot be undone.')) {
      deleteChart(id)
    }
  }

  function startRename(id: string, name: string) {
    setRenamingId(id)
    setRenameValue(name)
  }

  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await renameChart(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function getElementCount(id: string) {
    return charts[id]?.nodes.filter((n) => n.type === 'element').length ?? 0
  }
  function getScreenCount(id: string) {
    return charts[id]?.nodes.filter((n) => n.type === 'screen').length ?? 0
  }

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#ffffff', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em' }}>
            Flowcharts
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {metas.length} flowchart{metas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding:      '9px 20px',
            background:   '#6366f1',
            border:       'none',
            borderRadius:  6,
            color:        '#fff',
            cursor:       'pointer',
            fontFamily:   'IBM Plex Mono, monospace',
            fontSize:      13,
            fontWeight:    700,
            letterSpacing: '0.02em',
          }}
        >
          + New Flowchart
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000040', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 360, boxShadow: '0 20px 60px #0000001a' }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#1e293b' }}>
              New Flowchart
            </h3>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Flowchart name…"
              style={{
                width: '100%', padding: '9px 12px', marginBottom: 16,
                border: '1px solid #e2e8f0', borderRadius: 6,
                fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#1e293b',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setCreating(false); setNewName('') }}
                style={{ padding: '7px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b' }}>
                Cancel
              </button>
              <button onClick={handleCreate}
                style={{ padding: '7px 16px', background: '#6366f1', border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#fff', fontWeight: 700 }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && metas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && metas.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          border: '2px dashed #e2e8f0', borderRadius: 12,
          color: '#94a3b8',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⬡</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, marginBottom: 8, color: '#64748b' }}>
            No flowcharts yet. Create your first one.
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{ marginTop: 12, padding: '8px 20px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700 }}
          >
            + New Flowchart
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
        {metas.map((meta) => (
          <div
            key={meta.id}
            style={{
              background:   '#ffffff',
              border:       '1px solid #e2e8f0',
              borderRadius:  10,
              padding:       20,
              cursor:        'pointer',
              transition:   'box-shadow .15s, border-color .15s',
              boxShadow:    '0 1px 4px #0000000a',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow   = '0 4px 20px #6366f115'
              e.currentTarget.style.borderColor = '#6366f140'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow   = '0 1px 4px #0000000a'
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#6366f108', border: '1px solid #6366f120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, color: '#6366f1' }}>⬡</span>
              </div>
            </div>

            {/* Parallel badge */}
            {meta.has_parallel && (
              <div style={{
                display: 'inline-block', padding: '2px 8px', marginBottom: 6,
                background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4,
                fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600,
                color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Has Parallel
              </div>
            )}

            {/* Name */}
            {renamingId === meta.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', padding: '4px 6px', border: '1px solid #6366f1', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6, wordBreak: 'break-word' }}>
                {meta.name}
              </div>
            )}

            {/* Stats */}
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 14 }}>
              {getScreenCount(meta.id)} screen{getScreenCount(meta.id) !== 1 ? 's' : ''} · {getElementCount(meta.id)} element{getElementCount(meta.id) !== 1 ? 's' : ''}
            </div>

            {/* Date */}
            <div style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 16 }}>
              Created {new Date(meta.created_at).toLocaleDateString()}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleOpen(meta.id)}
                style={{ flex: 1, padding: '7px 0', background: '#6366f1', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700 }}
              >
                Open
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startRename(meta.id, meta.name) }}
                style={{ padding: '7px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, color: '#64748b', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(meta.id) }}
                style={{ padding: '7px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5, color: '#ef4444', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
