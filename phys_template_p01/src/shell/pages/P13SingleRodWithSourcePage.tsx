import { P13SingleRodWorkbenchPage } from './P13SingleRodWorkbenchPage';

interface Props {
  onBack: () => void;
}

export function P13SingleRodWithSourcePage({ onBack }: Props) {
  return <P13SingleRodWorkbenchPage variant="with-source" onBack={onBack} />;
}
