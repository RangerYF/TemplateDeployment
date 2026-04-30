import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
}

export function P13SingleRodResistivePage({ onBack }: Props) {
  return <P13SingleRodWorkbenchPage variant="resistive" onBack={onBack} />;
}
