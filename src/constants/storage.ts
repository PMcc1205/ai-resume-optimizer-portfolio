export const TASK_INPUT_STATE_KEY = 'resume-task-input-state'
export const REQUIREMENTS_STATE_KEY = 'resume-requirements-state'
export const OPTIMIZATION_SELECTION_KEY = 'resume-optimization-selection'
export const OPTIMIZATION_STATE_KEY = 'resume-optimization-state'
export const MATCHING_OPTIMIZATION_REQUIREMENTS_KEY = 'resume-matching-optimization-requirements'
export const MATCHING_RESOLUTION_ACTIONS_KEY = 'resume-matching-resolution-actions'
export const TASK_PROGRESS_STATE_KEY = 'resume-task-progress-state'
export const FACTS_SOURCE_KEY = 'resume-facts-source'
export const MAPPINGS_SOURCE_KEY = 'resume-mappings-source'
export const MAPPINGS_INPUT_KEY = 'resume-mappings-input'
export const MATCH_GAP_SOURCE_KEY = 'resume-match-gap-source'
export const MATCH_GAP_INPUT_KEY = 'resume-match-gap-input'
export const DIAGNOSIS_STATE_KEY = 'resume-diagnosis-state'
export const DIAGNOSIS_INPUT_KEY = 'resume-diagnosis-input'
export const DIAGNOSIS_SOURCE_KEY = 'resume-diagnosis-source'
export const REWRITE_INPUT_KEY = 'resume-rewrite-input'
export const REWRITE_SOURCE_KEY = 'resume-rewrite-source'

const WORKFLOW_STATE_KEYS = [
  TASK_INPUT_STATE_KEY,
  REQUIREMENTS_STATE_KEY,
  'resume-facts-state',
  FACTS_SOURCE_KEY,
  'resume-mappings-state',
  MAPPINGS_SOURCE_KEY,
  MAPPINGS_INPUT_KEY,
  MATCH_GAP_SOURCE_KEY,
  MATCH_GAP_INPUT_KEY,
  DIAGNOSIS_STATE_KEY,
  DIAGNOSIS_INPUT_KEY,
  DIAGNOSIS_SOURCE_KEY,
  REWRITE_INPUT_KEY,
  REWRITE_SOURCE_KEY,
  'resume-gaps-state',
  OPTIMIZATION_SELECTION_KEY,
  OPTIMIZATION_STATE_KEY,
  MATCHING_OPTIMIZATION_REQUIREMENTS_KEY,
  MATCHING_RESOLUTION_ACTIONS_KEY,
  TASK_PROGRESS_STATE_KEY,
]

export function resetWorkflowState() {
  WORKFLOW_STATE_KEYS.forEach((key) => sessionStorage.removeItem(key))
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith(`${TASK_PROGRESS_STATE_KEY}:`) || key.startsWith(`${MATCHING_RESOLUTION_ACTIONS_KEY}:`))
    .forEach((key) => sessionStorage.removeItem(key))
}
