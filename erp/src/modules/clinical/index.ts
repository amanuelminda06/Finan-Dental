export {
  CLINICAL_ROLES,
  CUSTOM_COLOR,
  PLAN_STATUSES,
  PLAN_STATUS_LABEL_KEYS,
  SUGGESTION_CATEGORIES,
  SURFACES,
  TEXT_KINDS,
  TOOTH_NUMBERS,
  isSuggestionCategory,
  isTextKind,
  isValidToothNumber,
} from './constants';
export type { PlanStatus, SuggestionCategory, TextKind } from './constants';

export {
  buildClinicalSearchText,
  normalizeSuggestionLabel,
  normalizeTextItems,
  segmentToothMentions,
  toothMentionsIn,
} from './text';
export type { ClinicalSearchInput, TextSegment } from './text';

export {
  getClinicalChart,
  getClinicalPlanItem,
  getToothColorsByFinding,
  listClinicalPatients,
  listClinicalServices,
  listClinicalSuggestions,
  rememberCustomFinding,
  rememberCustomTerm,
  rebuildClinicalSearchText,
  searchClinicalText,
} from './queries';
export type { ClinicalChartData } from './queries';

export {
  convertClinicalPlanItemAction,
  createClinicalVisitAction,
  saveClinicalPlanItemAction,
  saveClinicalProfileAction,
  saveClinicalToothAction,
  searchClinicalAction,
  updateClinicalPlanStatusAction,
} from './actions';

export { default as ClinicalProfileForm } from './components/ClinicalProfileForm';
export { default as ClinicalSearch } from './components/ClinicalSearch';
export { default as MedicalAlertBanner } from './components/MedicalAlertBanner';
export { default as Odontogram } from './components/Odontogram';
export { default as TreatmentPlan } from './components/TreatmentPlan';
export { default as VisitNoteForm } from './components/VisitNoteForm';
export { default as VisitNoteText } from './components/VisitNoteText';
export type { ClinicalPlanItemData } from './components/TreatmentPlan';
export type { ClinicalToothData } from './components/Odontogram';
