import { PhysicsWorkbenchLayout } from './PhysicsWorkbenchLayout'
import type { TemplateModule } from '@/templates'

interface EditorLayoutProps {
  moduleId: TemplateModule
  sceneId: string
  onSelectScene: (moduleId: TemplateModule, sceneId: string) => void
}

export function EditorLayout({ moduleId, sceneId, onSelectScene }: EditorLayoutProps) {
  return (
    <PhysicsWorkbenchLayout
      moduleId={moduleId}
      sceneId={sceneId}
      onSelectScene={onSelectScene}
    />
  )
}
