import type { PluginTranslationResource } from '@workflowbuilder/sdk';

import type { PaletteConfig } from './palette';
import type { ThemeConfig } from './theme';
import type { WorkflowConfig } from './workflow';

/**
 * The editor is described by data. This folder is the contract for that data.
 */

/* INDEX */

export type ProfileId = string;

export type ProfileIndexEntry = {
  id: ProfileId;
  label: string;
  description: string;
  /** A WBIcon name. Kept as a plain string so config files stay pure JSON. */
  icon: string;
};

export type ProfileIndex = { profiles: ProfileIndexEntry[] };

/* META */

export type StatusVocabularyEntry = {
  value: string;
  label: string;
  icon: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
};

/**
 * Which of a human node's properties feed the Tasks screen.
 */
export type TaskFieldMap = {
  assignee?: string;
  priority?: string;
  dueHours?: string;
  note?: string;
  allowReject?: string;
};

/** One row in the task detail's summary. */
export type RunSummaryRow = {
  label: string;
  /** A key of `run.context`. */
  key: string;
  format?: 'text' | 'money' | 'flag';
  /** `money` only — where to read the ISO currency code from. */
  currencyKey?: string;
  /** `flag` only. */
  trueText?: string;
  falseText?: string;
  strong?: boolean;
};

/**
 * The mocked upstream result a run carries, plus how to present it.
 */
export type RunConfig = {
  context: Record<string, unknown>;
  summary: RunSummaryRow[];
};

export type ProfileMeta = {
  id: ProfileId;
  label: string;
  description: string;
  icon: string;
  chrome: {
    documentTitle: string;
    /** The bar's only brand line, set as a small wordmark next to the logo. */
    tagline: string;
    nav: { id: string; label: string; icon: string }[];
  };
  statusVocabulary?: StatusVocabularyEntry[];
  /** Maps this domain's human-task property names onto the Tasks screen. */
  taskFields?: TaskFieldMap;
  /** Mocked run context + how the task detail presents it. */
  run?: RunConfig;
  translations?: PluginTranslationResource;
};

/* DOCUMENT */

/** The assembled document served by `GET /api/profiles/:id.json`. */
export type EditorProfile = ProfileMeta & {
  theme: ThemeConfig;
  palette: PaletteConfig;
  workflow: WorkflowConfig;
};
