import { createContext, useContext } from 'react'

export interface NodeAnimState {
  hidden: boolean                    // true → opacity 0
  animClass?: string                 // e.g. 'fc-fade-in'
  animDuration?: number              // seconds
  animDelay?: number                 // seconds (CSS delay on the animation itself)
  animKey?: string                   // change to force animation restart (causes re-mount)
}

export interface PresentationContextValue {
  presentationMode: boolean
  nodeStates: Record<string, NodeAnimState>  // keyed by node id
  showSteps?: boolean
  showDebug?: boolean
}

export const PresentationContext = createContext<PresentationContextValue>({
  presentationMode: false,
  nodeStates: {},
  showSteps: false,
  showDebug: false,
})

export function usePresentationContext() {
  return useContext(PresentationContext)
}
