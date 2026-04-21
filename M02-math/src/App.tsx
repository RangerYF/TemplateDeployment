/**
 * App — Root component.
 *
 * Delegates all routing and skill switching to the SkillManager,
 * which lazy-loads each skill module for optimal bundle splitting.
 */
import { SkillManager } from '@/skills/SkillManager';

export default function App() {
  return <SkillManager />;
}
