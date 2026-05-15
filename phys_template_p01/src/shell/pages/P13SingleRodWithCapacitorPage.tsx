import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
}

export function P13SingleRodWithCapacitorPage({ onBack, onSelectPreset }: Props) {
  return (
    <P13SingleRodWorkbenchPage
      variant="with-capacitor"
      onBack={onBack}
      onSelectPreset={onSelectPreset}
    />
  );
}
