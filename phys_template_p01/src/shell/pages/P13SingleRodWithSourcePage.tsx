import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
}

export function P13SingleRodWithSourcePage({ onBack, onSelectPreset }: Props) {
  return (
    <P13SingleRodWorkbenchPage
      variant="with-source"
      onBack={onBack}
      onSelectPreset={onSelectPreset}
    />
  );
}
