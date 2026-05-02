import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { flowchartsApi } from '../api/client'
import { useFlowchartStore } from '../store/useFlowchartStore'
import type { FlowNode, FlowEdge } from '../store/useFlowchartStore'
import { AnimationPlayer } from '../components/flowchart/animation/AnimationPlayer'
import FlowCanvas from '../components/flowchart/FlowCanvas'

type Tab = 'preview' | 'canvas'

export default function FlowchartView() {
  const { shareId } = useParams<{ shareId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const tab: Tab = location.pathname.endsWith('/canvas') ? 'canvas' : 'preview'
  const [chartName, setChartName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!shareId) return
    setLoading(true)
    flowchartsApi.getPublic(shareId).then((res) => {
      const data = res.data
      setChartName(data.name ?? 'Flowchart')

      const chartId = data.id as string
      const nodes = (data.nodes ?? []) as FlowNode[]
      const edges = (data.edges ?? []) as FlowEdge[]

      useFlowchartStore.setState((s) => ({
        activeChartId: chartId,
        charts: { ...s.charts, [chartId]: { nodes, edges } },
        metas: [{ id: chartId, name: data.name, created_at: data.created_at, updated_at: data.updated_at }],
      }))
      setLoading(false)
      setReady(true)
    }).catch(() => {
      setError('This flowchart is not available or the link is invalid.')
      setLoading(false)
    })
  }, [shareId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="font-mono text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div style={{ fontSize: 36 }}>⬡</div>
        <div className="font-mono text-sm text-gray-500">{error}</div>
        <Link to="/" className="font-mono text-xs text-indigo-500 hover:text-indigo-600 transition-colors">
          Go to home
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Floating header — sits above everything */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e5e7eb',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-2 h-2 bg-indigo-500 flex-shrink-0" />
            <span className="font-mono text-xs font-bold text-gray-900 tracking-widest uppercase hidden sm:inline">
              Flowchart AI
            </span>
          </Link>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <span className="font-mono text-sm text-gray-700 truncate">{chartName}</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
          <TabBtn active={tab === 'preview'} onClick={() => navigate(`/view/${shareId}/preview`, { replace: true })}>Preview</TabBtn>
          <TabBtn active={tab === 'canvas'} onClick={() => navigate(`/view/${shareId}/canvas`, { replace: true })}>Canvas</TabBtn>
        </div>
      </header>

      {/* Content — reuse exact editor components */}
      {ready && tab === 'preview' && (
        <ReactFlowProvider key="preview">
          <AnimationPlayer onClose={() => navigate(`/view/${shareId}/canvas`, { replace: true })} hideClose topOffset={45} />
        </ReactFlowProvider>
      )}
      {ready && tab === 'canvas' && (
        <ReactFlowProvider key="canvas">
          <div style={{ position: 'fixed', inset: 0, paddingTop: 45 }}>
            <FlowCanvas readOnly readOnlyTopOffset={45} />
          </div>
        </ReactFlowProvider>
      )}
    </>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs px-3 py-1.5 rounded transition-all ${
        active
          ? 'bg-white text-gray-900 shadow-sm font-medium'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}
