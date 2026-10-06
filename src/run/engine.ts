import {
  type WorkflowBuilderEdge,
  type WorkflowBuilderNode,
  getStoreEdges,
  getStoreNodes,
} from '@workflowbuilder/sdk';

import type { TaskFieldMap } from '@/config/types/profile';

import { useRunStore } from './store';

/**
 * A deterministic interpreter for the diagram that is already on the canvas.
 *
 * It reads nodes and edges out of the SDK store rather than out of the config,
 * so the thing being executed is the thing you just edited: retune the branch
 * condition in the properties panel and the next run takes the other path. Same
 * JSON, two surfaces — design and run.
 *
 * A module singleton, not a hook: a run parked on a human task has to survive
 * navigating away, and its timers must not die with a component.
 */

const STEP_DELAY_MS = 900;

/**
 * Pending step timers, keyed by execution.
 *
 * A flat Set could only ever be cleared wholesale, and several runs are routinely
 * in flight at once — so cancelling one meant cancelling all of them.
 */
const timers = new Map<string, Set<ReturnType<typeof setTimeout>>>();

/** Matches the spec's "#1842". Bumped per run so ids read like real ones. */
let nextExecutionNumber = 1842;

/**
 * The active profile's human-task property names. Set by App whenever the
 * profile changes; the engine is a plain module, so this is its config channel.
 */
let taskFields: TaskFieldMap = {};

/**
 * The mocked upstream result each run starts with, keyed `<nodeType>.<output>`.
 * Branch conditions resolve `{{...}}` against it, so it MUST come from the
 * profile: the invoice flow compares `{{nodes.n2.amount}}` while the editorial
 * one compares `{{nodes.c2.readability}}`, and a hard-coded map silently
 * resolved the other profile's operand to `undefined` — which coerced to 0 and
 * "worked" by luck.
 */
let runContext: Record<string, unknown> = {};

let activeProfileId = '';

export const configureRun = (
  profileId: string,
  map: TaskFieldMap | undefined,
  context: Record<string, unknown> | undefined,
): void => {
  /*
   * A different profile means a different diagram in the store. Runs parked on a
   * human task are safe to leave alone: they hold no timer, and `resolveTask`
   * refuses to resume one under the wrong profile, so switching away and back
   * again finds them exactly where they were. Runs with a step in flight are not
   * safe — their next tick would land on the new graph.
   */
  if (profileId !== activeProfileId) {
    const { executions } = useRunStore.getState();
    for (const execId of [...timers.keys()]) {
      if (executions[execId]?.profileId !== profileId) abandon(execId);
    }
  }

  activeProfileId = profileId;
  taskFields = map ?? {};
  runContext = context ?? {};
};

type Props = Record<string, unknown>;

const propertiesOf = (node: WorkflowBuilderNode): Props =>
  ((node.data as { properties?: Props })?.properties ?? {}) as Props;

const paletteTypeOf = (node: WorkflowBuilderNode): string =>
  String((node.data as { type?: unknown })?.type ?? '');

const labelOf = (node: WorkflowBuilderNode): string =>
  String(propertiesOf(node).label ?? paletteTypeOf(node) ?? node.id);

const isHumanNode = (node: WorkflowBuilderNode) => /\.human$/.test(paletteTypeOf(node));

const branchesOf = (node: WorkflowBuilderNode): DecisionBranch[] => {
  const value = propertiesOf(node).decisionBranches;
  return Array.isArray(value) ? (value as DecisionBranch[]) : [];
};

type Condition = {
  x: string;
  comparisonOperator: string;
  y: string;
  logicalOperator?: string;
};

type DecisionBranch = {
  id: string;
  label?: string;
  conditions?: Condition[];
};

/* --------------------------------------------------------------- operands */

/**
 * `"nodes.n2.amount"` → `"ai.analyze.amount"`.
 *
 * The properties panel writes an operand as `{{nodes.<nodeId>.<output>}}`, and
 * that prefix is not cosmetic: it is the only shape the SDK can TYPE against a
 * node's `outputSchema`, and a typed operand is the sole reason the conditional
 * editor offers `>` and `<` at all. An operand it cannot type falls back to
 * `string`, whose operator list has no comparisons in it.
 *
 * Run context is authored per node TYPE, not per node id, so the id is resolved
 * through the live store: one context entry serves the seeded node AND one you
 * just dropped from the palette, which has an id no config could have known.
 */
const contextKey = (template: string): string => {
  const scoped = /^nodes\.([^.]+)\.(.+)$/.exec(template);
  if (!scoped) return template;
  const node = getStoreNodes().find((candidate) => candidate.id === scoped[1]);
  return node ? `${paletteTypeOf(node)}.${scoped[2]}` : template;
};

const lookup = (template: string, context: Record<string, unknown>): unknown => {
  const key = contextKey(template.trim());
  return key in context ? context[key] : context[template.trim()];
};

/** `"{{nodes.n2.amount}}"` → the run context value. Operands are templates, not names. */
const resolveOperand = (raw: string, context: Record<string, unknown>): unknown => {
  const whole = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(raw);
  if (whole) return lookup(whole[1], context);
  // Mixed text: interpolate, then let coercion decide if it is a number.
  return raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) =>
    String(lookup(key, context) ?? ''),
  );
};

const coerce = (value: unknown): number | string | boolean => {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value ?? '').trim();
  if (text !== '' && Number.isFinite(Number(text))) return Number(text);
  return text;
};

const compare = (left: unknown, operator: string, right: unknown): boolean => {
  const l = coerce(left);
  const r = coerce(right);
  const numeric = typeof l === 'number' && typeof r === 'number';

  switch (operator) {
    case 'isEqual':
      return numeric ? l === r : String(l) === String(r);
    case 'isNotEqual':
      return numeric ? l !== r : String(l) !== String(r);
    case 'isGreaterThan':
      return Number(l) > Number(r);
    case 'isGreaterThanOrEqual':
      return Number(l) >= Number(r);
    case 'isLessThan':
      return Number(l) < Number(r);
    case 'isLessThanOrEqual':
      return Number(l) <= Number(r);
    case 'isContaining':
      return String(l).toLowerCase().includes(String(r).toLowerCase());
    case 'isNotContaining':
      return !String(l).toLowerCase().includes(String(r).toLowerCase());
    case 'isBefore':
      return Date.parse(String(l)) < Date.parse(String(r));
    case 'isAfter':
      return Date.parse(String(l)) > Date.parse(String(r));
    default:
      return false;
  }
};

/**
 * `logicalOperator` joins a condition with the NEXT one (per the SDK's type
 * docs), so folding left uses the PREDECESSOR's operator to combine.
 */
const evaluate = (conditions: Condition[], context: Record<string, unknown>): boolean => {
  return conditions.reduce((accumulated, condition, index) => {
    const result = compare(
      resolveOperand(condition.x, context),
      condition.comparisonOperator,
      resolveOperand(condition.y, context),
    );
    if (index === 0) return result;
    const joiner = String(conditions[index - 1].logicalOperator ?? 'AND').toUpperCase();
    return joiner === 'OR' ? accumulated || result : accumulated && result;
  }, true);
};

/**
 * First branch whose conditions hold. A branch with no conditions is the
 * default — that is how the seeded "Auto-approve" branch is authored.
 */
const pickBranch = (
  node: WorkflowBuilderNode,
  context: Record<string, unknown>,
): DecisionBranch | undefined => {
  const branches = branchesOf(node);
  const matched = branches.find(
    (branch) => branch.conditions?.length && evaluate(branch.conditions, context),
  );
  return (
    matched ??
    branches.find((branch) => !branch.conditions?.length) ??
    branches[branches.length - 1]
  );
};

/* ------------------------------------------------------------------ graph */

const outgoing = (
  edges: WorkflowBuilderEdge[],
  nodeId: string,
  branchId?: string,
): WorkflowBuilderEdge[] => {
  return edges.filter((edge) => {
    if (edge.source !== nodeId) return false;
    if (branchId === undefined) return true;
    return edge.sourceHandle?.endsWith(`:inner:${branchId}`) ?? false;
  });
};

const findStart = (
  nodes: WorkflowBuilderNode[],
  edges: WorkflowBuilderEdge[],
): WorkflowBuilderNode | undefined => {
  return (
    nodes.find((node) => node.data.isStartNode) ??
    nodes.find((node) => node.type === 'start-node') ??
    nodes.find((node) => !edges.some((edge) => edge.target === node.id))
  );
};

/* ----------------------------------------------------------------- engine */

const later = (execId: string, run: () => void) => {
  const pending = timers.get(execId) ?? new Set<ReturnType<typeof setTimeout>>();
  timers.set(execId, pending);

  const timer = setTimeout(() => {
    pending.delete(timer);
    if (!pending.size) timers.delete(execId);
    run();
  }, STEP_DELAY_MS);
  pending.add(timer);
};

/** Drops one run's pending steps. The run itself is left to the caller to label. */
const cancelSteps = (execId: string) => {
  const pending = timers.get(execId);
  if (!pending) return;
  for (const timer of pending) clearTimeout(timer);
  timers.delete(execId);
};

/** Ends a run whose diagram is no longer loaded. */
const abandon = (execId: string) => {
  const store = useRunStore.getState();
  cancelSteps(execId);
  store.setStatus(execId, 'cancelled');
  store.log(execId, 'Workflow abandoned');
};

/** Reads a task field through the profile's name mapping. */
const taskField = (properties: Props, role: keyof TaskFieldMap): unknown => {
  const name = taskFields[role];
  return name ? properties[name] : undefined;
};

/** The suspension point. A task is created and the engine stops — no timer. */
const suspend = (execId: string, node: WorkflowBuilderNode) => {
  const store = useRunStore.getState();
  const properties = propertiesOf(node);

  const assignee = String(taskField(properties, 'assignee') ?? 'Unassigned');
  const rejectFlag = taskField(properties, 'allowReject');

  store.setNodeStatus(execId, node.id, 'waiting');
  store.setStatus(execId, 'waiting');
  store.createTask({
    id: `${execId}:${node.id}`,
    profileId: store.executions[execId]?.profileId ?? activeProfileId,
    execId,
    nodeId: node.id,
    title: `${labelOf(node)} #${execId}`,
    assignee,
    priority: String(taskField(properties, 'priority') ?? 'normal'),
    dueAfterHours: Number(taskField(properties, 'dueHours') ?? 24),
    // No mapped flag means the profile never disables Reject.
    allowReject: rejectFlag === undefined ? true : rejectFlag !== false,
    reviewerNote: String(taskField(properties, 'note') ?? ''),
  });
  store.log(execId, 'Human task created', `Assigned to ${assignee}`);
};

const advance = (execId: string, nodeId: string) => {
  const store = useRunStore.getState();
  const execution = store.executions[execId];
  if (!execution) return;

  const nodes = getStoreNodes();
  const edges = getStoreEdges();
  const node = nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    store.log(execId, `Step ${nodeId} is missing from the diagram`);
    store.setStatus(execId, 'failed');
    return;
  }

  if (isHumanNode(node)) {
    suspend(execId, node);
    return;
  }

  store.setNodeStatus(execId, nodeId, 'running');
  store.log(execId, `${labelOf(node)} started`);

  later(execId, () => {
    const live = useRunStore.getState();
    if (!live.executions[execId]) return;

    if (live.executions[execId].profileId !== activeProfileId) {
      abandon(execId);
      return;
    }
    live.setNodeStatus(execId, nodeId, 'done');

    const context = live.executions[execId].context;
    const branches = branchesOf(node);
    let branchId: string | undefined;

    if (branches.length) {
      const branch = pickBranch(node, context);
      branchId = branch?.id;
      live.log(
        execId,
        `${labelOf(node)} evaluated`,
        branch ? `Took the “${branch.label ?? branch.id}” branch` : 'No branch matched',
      );
    } else {
      live.log(execId, `${labelOf(node)} completed`);
    }

    const next = outgoing(edges, nodeId, branchId)[0];
    if (next) {
      advance(execId, next.target);
    } else {
      live.setStatus(execId, 'completed');
      live.log(execId, 'Workflow completed');
    }
  });
};

export const startRun = (workflowName: string): string | null => {
  const nodes = getStoreNodes();
  const edges = getStoreEdges();
  const start = findStart(nodes, edges);
  if (!start) return null;

  const execId = String(nextExecutionNumber++);
  const steps = nodes.map((node) => ({ id: node.id, label: labelOf(node) }));

  /*
   * A copy, so later runs are unaffected if anything mutates one execution's
   * context. The values come from `profile.run.context` — which is what the
   * seeded condition compares against, so editing the threshold in the
   * properties panel really does send the next run down the other branch.
   */
  useRunStore
    .getState()
    .createExecution(execId, activeProfileId, workflowName, steps, { ...runContext });

  advance(execId, start.id);
  return execId;
};

/**
 * Resume. Approve continues along the node's outgoing edge; reject ends the run.
 *
 * There is deliberately no reject branch in the seeded diagram — the Human
 * Approval node has exactly one outgoing edge, labelled "Approved". So a
 * rejection is a terminal state, not a detour, and the run is marked `rejected`
 * rather than silently "completed".
 */
export const resolveTask = (taskId: string, decision: 'approve' | 'reject', comment?: string) => {
  const store = useRunStore.getState();
  const task = store.tasks[taskId];
  if (!task || task.status !== 'pending') return;

  /*
   * Never resume across profiles. `advance` walks whatever diagram the SDK store
   * currently holds, so resuming a task raised under a different profile would
   * step through unrelated nodes. The views already filter by profile; this is
   * the backstop that makes the rule impossible to bypass.
   */
  if (task.profileId !== activeProfileId) return;

  store.closeTask(taskId, decision === 'approve' ? 'completed' : 'rejected', comment);

  const { execId, nodeId } = task;
  store.setNodeStatus(execId, nodeId, decision === 'approve' ? 'done' : 'rejected');
  store.log(
    execId,
    decision === 'approve' ? 'Approved by user' : 'Rejected by user',
    comment?.trim() ? comment.trim() : undefined,
  );

  if (decision === 'reject') {
    store.setStatus(execId, 'rejected');
    store.log(execId, 'Workflow stopped — no reject path is configured');
    return;
  }

  store.setStatus(execId, 'running');
  store.trackExecution(execId);
  store.log(execId, 'Workflow resumed');

  const next = outgoing(getStoreEdges(), nodeId)[0];
  if (next) {
    advance(execId, next.target);
  } else {
    store.setStatus(execId, 'completed');
    store.log(execId, 'Workflow completed');
  }
};
