import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ControlPanel } from '@/components/panels/ControlPanel';
import { KnowledgePanel } from '@/components/panels/KnowledgePanel';
import { COLORS } from '@/styles/tokens';
import { getCurrentModel, useElectrochemStore } from '@/store/electrochemStore';

export function RightSidebar() {
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const model = getCurrentModel({ selectedModelId });

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-l" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
      <div className="border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>{model.title}</div>
        <p className="mt-1 text-xs leading-5" style={{ color: COLORS.textMuted }}>{model.apparatusNote}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Tabs defaultValue="control" className="space-y-4">
          <TabsList className="w-full justify-between">
            <TabsTrigger value="control" className="flex-1">控制</TabsTrigger>
            <TabsTrigger value="knowledge" className="flex-1">原理</TabsTrigger>
          </TabsList>
          <TabsContent value="control"><ControlPanel /></TabsContent>
          <TabsContent value="knowledge"><KnowledgePanel /></TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
