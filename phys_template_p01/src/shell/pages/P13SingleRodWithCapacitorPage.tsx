import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
}

export function P13SingleRodWithCapacitorPage({ onBack }: Props) {
  return <P13SingleRodWorkbenchPage variant="with-capacitor" onBack={onBack} />;
}
