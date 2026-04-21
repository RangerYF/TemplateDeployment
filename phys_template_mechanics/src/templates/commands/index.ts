export {
  executeTemplateCommandProgram,
  executeTemplateCommandProgramWithRefs,
  TemplateCommandExecutionError,
} from './executor'

export {
  validateScene,
  validateProgramAgainstScene,
  formatSceneDiffs,
  validateSceneSanity,
  formatSceneSanityIssues,
} from './validator'

export {
  templateCommandPrograms,
  getTemplateCommandProgram,
} from './examples'

export {
  TEMPLATE_COMMAND_API_CATEGORIES,
} from './schema'

export type {
  Vec2,
  TemplateCommand,
  TemplateCommandKind,
  TemplateCommandProgram,
  TemplateCommandRefs,
  TemplateCommandApiCategory,
  SetGravityCommand,
  AddBodyCommand,
  PatchBodyCommand,
  SnapToCommand,
  AddJointCommand,
  PatchJointCommand,
  AddForceCommand,
  PatchForceCommand,
} from './schema'

export type {
  SceneDiffEntry,
  SceneValidationResult,
  SceneSanityIssue,
  SceneSanityResult,
} from './validator'
