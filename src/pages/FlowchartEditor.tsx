import { useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import FlowCanvas from '../components/flowchart/FlowCanvas'
import { useFlowchartStore } from '../store/useFlowchartStore'

export default function FlowchartEditor() {
  const { id } = useParams<{ id: string }>()
  const { metas, loadCharts, setActiveChart, activeChartId } = useFlowchartStore()

  // Load metas if not yet loaded (e.g. direct URL navigation)
  useEffect(() => {
    if (metas.length === 0) loadCharts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const found = metas.find((m) => m.id === id)

  // useLayoutEffect runs synchronously after DOM mutations, before paint —
  // safe for state updates and avoids the "setState during render" warning.
  const activatedRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (id && found && activatedRef.current !== id) {
      activatedRef.current = id
      if (activeChartId !== id) setActiveChart(id)
    }
  }) // runs after every render — ref guard ensures it only fires once per id

  if (!id || !found) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#ffffff', fontFamily: 'IBM Plex Mono, monospace', gap: 16,
      }}>
        <div style={{ fontSize: 36 }}>⬡</div>
        <div style={{ fontSize: 16, color: '#64748b' }}>Flowchart not found</div>
        <Link
          to="/flowchart"
          style={{ padding: '8px 20px', background: '#6366f1', borderRadius: 6, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}
        >
          Back to Flowcharts
        </Link>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <FlowCanvas />
      </div>
    </ReactFlowProvider>
  )
}
