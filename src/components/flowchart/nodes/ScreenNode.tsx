import { memo } from 'react'
import { NodeProps, NodeResizer, Handle, Position } from '@xyflow/react'
import type { ScreenData } from '../../../types/flowchart'
import { useFlowchartStore } from '../../../store/useFlowchartStore'
import { usePresentationContext } from '../PresentationContext'

export const ScreenNode = memo(({ id, data, selected }: NodeProps) => {
  const { selectNode, updateNodeSize } = useFlowchartStore()
  const d = data as unknown as ScreenData
  const { presentationMode } = usePresentationContext()

  return (
    <div
      style={{
        width:    '100%',
        height:   '100%',
        position: 'relative',
      }}
      onClick={() => !presentationMode && selectNode(id)}
    >
      {/* Label above the screen — hidden in presentation mode */}
      {!presentationMode && (
        <div style={{
          position:       'absolute',
          top:            -26,
          left:           0,
          right:          0,
          height:         22,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 4px',
          pointerEvents:  'none',
          userSelect:     'none',
        }}>
          <span style={{
            color:         selected ? '#6366f1' : '#64748b',
            fontSize:      10,
            fontFamily:    'IBM Plex Mono, monospace',
            fontWeight:    600,
            letterSpacing: '0.03em',
            whiteSpace:    'nowrap',
          }}>
            {d.order + 1}. {d.label}
          </span>
          <span style={{
            color:      '#94a3b8',
            fontSize:   9,
            fontFamily: 'IBM Plex Mono, monospace',
            whiteSpace: 'nowrap',
          }}>
            {d.ratio}
          </span>
        </div>
      )}

      {/* Screen body */}
      <div style={{
        width:           '100%',
        height:          '100%',
        backgroundColor: d.backgroundColor,
        border:          presentationMode ? 'none' : `2px solid ${selected ? '#6366f1' : d.borderColor}`,
        borderRadius:    6,
        position:        'relative',
        boxShadow:       presentationMode ? 'none' : (selected
          ? '0 0 0 3px #6366f133, 0 4px 20px #6366f122'
          : '0 2px 8px #00000010'),
        transition:      'box-shadow .15s, border-color .15s',
        overflow:        'visible',
      }}>
        {!presentationMode && (
          <NodeResizer
            isVisible={selected}
            minWidth={120}
            minHeight={80}
            keepAspectRatio
            lineStyle={{ borderColor: '#6366f1' }}
            handleStyle={{ backgroundColor: '#6366f1', width: 8, height: 8, borderRadius: 2 }}
            onResizeEnd={(_event, params) => {
              updateNodeSize(id, params.width, params.height)
            }}
          />
        )}

        {!presentationMode && (
          <>
            <Handle type="source" position={Position.Top}    id="top"    className="fc-handle" style={{ background: '#6366f1', border: '2px solid #fff', width: 12, height: 12, transition: 'opacity .12s' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="fc-handle" style={{ background: '#6366f1', border: '2px solid #fff', width: 12, height: 12, transition: 'opacity .12s' }} />
            <Handle type="source" position={Position.Left}   id="left"   className="fc-handle" style={{ background: '#6366f1', border: '2px solid #fff', width: 12, height: 12, transition: 'opacity .12s' }} />
            <Handle type="source" position={Position.Right}  id="right"  className="fc-handle" style={{ background: '#6366f1', border: '2px solid #fff', width: 12, height: 12, transition: 'opacity .12s' }} />
          </>
        )}
      </div>
    </div>
  )
})

ScreenNode.displayName = 'ScreenNode'
