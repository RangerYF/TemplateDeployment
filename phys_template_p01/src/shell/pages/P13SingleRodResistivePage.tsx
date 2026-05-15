import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
}

export function P13SingleRodResistivePage({ onBack, onSelectPreset }: Props) {
  return (
    <P13SingleRodWorkbenchPage
      variant="resistive"
      onBack={onBack}
      onSelectPreset={onSelectPreset}
    />
  );
}
