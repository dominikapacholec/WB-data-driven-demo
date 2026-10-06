import type { PaletteItem } from '@workflowbuilder/sdk';

import type { NodeConfig } from '../types/palette';
import { buildDefaults } from './build-defaults';
import { buildSchema } from './build-schema';
import { buildUiSchema } from './build-ui-schema';

export const buildPaletteItem = (node: NodeConfig): PaletteItem => {
  return {
    type: node.type,
    label: node.label,
    description: node.description,
    icon: node.icon,
    ...(node.templateType ? { templateType: node.templateType } : {}),
    ...(node.isStartNode ? { isStartNode: true } : {}),
    schema: buildSchema(node),
    uischema: buildUiSchema(node),
    defaultPropertiesData: buildDefaults(node),
    ...(node.outputSchema ? { outputSchema: node.outputSchema } : {}),
  } as unknown as PaletteItem;
};
