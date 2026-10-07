import { create } from 'zustand';

export type NodeRunStatus = 'running' | 'done' | 'waiting' | 'rejected' | 'skipped';

export type ExecutionStatus =
  'running' | 'waiting' | 'completed' | 'rejected' | 'failed' | 'cancelled';

export type TaskStatus = 'pending' | 'completed' | 'rejected';

export type LogEntry = { at: string; text: string; detail?: string };

/**
 * The plan of the run: every node in the diagram, in seed order, captured when
 * the run starts. Steps a branch never reaches simply stay unvisited — which is
 * exactly what the spec's "○ Process payment" placeholder means.
 */
export type Step = { id: string; label: string };

export type Execution = {
  id: string;
  profileId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  currentNodeId: string | null;
  steps: Step[];
  nodeStatus: Record<string, NodeRunStatus>;
  log: LogEntry[];
  /** The mocked AI result. Condition operands resolve `{{...}}` against this. */
  context: Record<string, unknown>;
};

export type Task = {
  id: string;
  profileId: string;
  execId: string;
  nodeId: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  assignee: string;
  priority: string;
  dueAfterHours: number;
  allowReject: boolean;
  reviewerNote: string;
  comment?: string;
};

type RunState = {
  executions: Record<string, Execution>;
  order: string[];
  tasks: Record<string, Task>;
  taskOrder: string[];
  trackedExecId: string | null;
  /** The task shown in the Tasks view; lives here so the tracker can deep-link to it. */
  openTaskId: string | null;

  createExecution: (
    execId: string,
    profileId: string,
    workflowName: string,
    steps: Step[],
    context: Record<string, unknown>,
  ) => void;
  setNodeStatus: (execId: string, nodeId: string, status: NodeRunStatus) => void;
  log: (execId: string, text: string, detail?: string) => void;
  setStatus: (execId: string, status: ExecutionStatus) => void;
  createTask: (task: Omit<Task, 'status' | 'createdAt'>) => void;
  closeTask: (taskId: string, status: TaskStatus, comment?: string) => void;
  trackExecution: (execId: string | null) => void;
  trackNewestFor: (profileId: string) => void;
  openTask: (taskId: string | null) => void;
  clear: () => void;
};

export const stamp = (): string => {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/** Immutable per-execution patch — zustand needs a fresh object to notify. */
const patch = (state: RunState, execId: string, change: (execution: Execution) => Execution) => {
  const execution = state.executions[execId];
  if (!execution) return state;
  return { ...state, executions: { ...state.executions, [execId]: change(execution) } };
};

export const useRunStore = create<RunState>((set) => ({
  executions: {},
  order: [],
  tasks: {},
  taskOrder: [],
  trackedExecId: null,
  openTaskId: null,

  createExecution: (execId, profileId, workflowName, steps, context) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [execId]: {
          id: execId,
          profileId,
          workflowName,
          status: 'running',
          startedAt: stamp(),
          currentNodeId: null,
          steps,
          nodeStatus: {},
          log: [{ at: stamp(), text: 'Workflow started' }],
          context,
        },
      },
      order: [execId, ...state.order],
      trackedExecId: execId,
    })),

  setNodeStatus: (execId, nodeId, status) =>
    set((state) =>
      patch(state, execId, (execution) => ({
        ...execution,
        currentNodeId: status === 'done' ? execution.currentNodeId : nodeId,
        nodeStatus: { ...execution.nodeStatus, [nodeId]: status },
      })),
    ),

  log: (execId, text, detail) =>
    set((state) =>
      patch(state, execId, (execution) => ({
        ...execution,
        log: [...execution.log, { at: stamp(), text, detail }],
      })),
    ),

  setStatus: (execId, status) =>
    set((state) =>
      patch(state, execId, (execution) => ({
        ...execution,
        status,
        currentNodeId:
          status === 'running' || status === 'waiting' ? execution.currentNodeId : null,
      })),
    ),

  createTask: (task) =>
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: { ...task, status: 'pending', createdAt: stamp() } },
      taskOrder: [task.id, ...state.taskOrder],
    })),

  closeTask: (taskId, status, comment) =>
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      return { tasks: { ...state.tasks, [taskId]: { ...task, status, comment } } };
    }),

  trackExecution: (execId) => set({ trackedExecId: execId }),

  trackNewestFor: (profileId) =>
    set((state) => ({
      trackedExecId:
        state.order.find((id) => state.executions[id]?.profileId === profileId) ?? null,
    })),

  openTask: (taskId) => set({ openTaskId: taskId }),

  clear: () =>
    set({
      executions: {},
      order: [],
      tasks: {},
      taskOrder: [],
      trackedExecId: null,
      openTaskId: null,
    }),
}));
