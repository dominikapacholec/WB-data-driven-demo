import type { WorkflowBuilderEdge, WorkflowBuilderNode } from '@workflowbuilder/sdk';

import type { NodeConfig } from '../types/palette';
import type { Seed, SeedEdge, SeedNode } from '../types/workflow';
import { buildDefaults } from './build-defaults';
import { ProfileError } from './profile-error';

/**
 * The initial diagram: config entries in, xyflow nodes and edges out.
 *
 * `workflow.json` names nodes by palette `type` rather than repeating them, so
 * every seed node is resolved against the palette index — that is where its
 * look and defaults come from, and why an unknown type fails loudly here
 * instead of rendering as a blank node.
 */

const buildNode = (seed: SeedNode, index: Map<string, NodeConfig>): WorkflowBuilderNode => {
  const def = index.get(seed.nodeType);
  if (!def) {
    throw new ProfileError(
      `Seed node "${seed.id}" references unknown palette type "${seed.nodeType}". ` +
        `Known types: ${[...index.keys()].join(', ')}`,
    );
  }
  return {
    id: seed.id,
    type: def.templateType ?? 'node',
    position: seed.position,
    data: {
      segments: [],
      type: def.type,
      icon: def.icon,
      ...(def.isStartNode ? { isStartNode: true } : {}),
      properties: { ...buildDefaults(def), ...(seed.properties ?? {}) },
    },
  } as unknown as WorkflowBuilderNode;
};

const buildEdge = (edge: SeedEdge): WorkflowBuilderEdge => {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'labelEdge',
    ...(edge.sourceBranch ? { sourceHandle: `source:inner:${edge.sourceBranch}` } : {}),
    ...(edge.label || edge.icon
      ? {
          data: {
            ...(edge.label ? { label: edge.label } : {}),
            ...(edge.icon ? { icon: edge.icon } : {}),
          },
        }
      : {}),
  } as unknown as WorkflowBuilderEdge;
};

export const compileInitialDiagram = (seed: Seed, index: Map<string, NodeConfig>) => {
  return {
    nodes: seed.nodes.map((n) => buildNode(n, index)),
    edges: seed.edges.map(buildEdge),
  };
};
