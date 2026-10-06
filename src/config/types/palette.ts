import type { IfThenElseSchema } from '@workflowbuilder/sdk';

export type FieldSchemaConfig = Record<string, unknown>;

export type NodeConfig = {
  type: string;
  label: string;
  description: string;
  /** WBIcon name */
  icon: string;
  templateType?: 'node' | 'start-node' | 'ai-node' | 'decision-node';
  /** The workflow's entry point; the SDK copies it into the dropped node's `data`. */
  isStartNode?: boolean;
  properties?: Record<string, FieldSchemaConfig>;
  required?: string[];
  /** Conditional validation */
  allOf?: IfThenElseSchema[];
  ui?: {
    preset?: 'general' | 'none';
    elements: unknown[];
    globalControls?: boolean;
  };
  defaults?: Record<string, unknown>;
  outputSchema?: unknown;
};

export type PaletteEntryConfig =
  | { kind: 'group'; label: string; isOpen?: boolean; nodes: NodeConfig[] }
  | ({ kind: 'node' } & NodeConfig);

export type PaletteConfig = { entries: PaletteEntryConfig[] };
