import { Icon, type WBIcon } from '@workflowbuilder/sdk';
import { useMemo } from 'react';

import { navigate } from '@/app/use-hash-route';
import { Dropdown, type DropdownOption } from '@/components/dropdown/dropdown';
import { Tooltip } from '@/components/tooltip/tooltip';
import { type Execution, useRunStore } from '@/run/store';
import { StatusPill } from '@/views/status-pill/status-pill';

import styles from './run-tracker.module.css';

const OPTION_ICON: Record<string, WBIcon> = {
  running: 'CircleNotch',
  waiting: 'UserFocus',
  completed: 'CheckCircle',
  rejected: 'XCircle',
  failed: 'Warning',
  cancelled: 'Prohibit',
};

/** Open == still going somewhere: it can still change the badges you see. */
const isOpen = (execution: Execution): boolean =>
  execution.status === 'running' || execution.status === 'waiting';

const position = (execution: Execution): string => {
  if (!execution.currentNodeId) return `started ${execution.startedAt}`;
  const step = execution.steps.find((candidate) => candidate.id === execution.currentNodeId);
  return `at ${step?.label ?? execution.currentNodeId}`;
};

export const RunTracker = ({ profileId }: { profileId: string }) => {
  const order = useRunStore((state) => state.order);
  const executions = useRunStore((state) => state.executions);
  const trackedExecId = useRunStore((state) => state.trackedExecId);
  const trackExecution = useRunStore((state) => state.trackExecution);
  const tasks = useRunStore((state) => state.tasks);
  const taskOrder = useRunStore((state) => state.taskOrder);
  const openTask = useRunStore((state) => state.openTask);

  const runs = useMemo(
    () => order.map((id) => executions[id]).filter((run) => run?.profileId === profileId),
    [order, executions, profileId],
  );

  const options = useMemo<DropdownOption[]>(
    () =>
      runs.map((run) => ({
        value: run.id,
        label: `#${run.id} - ${position(run)}`,
        icon: OPTION_ICON[run.status],
      })),
    [runs],
  );

  if (!runs.length) return null;

  const tracked = trackedExecId ? executions[trackedExecId] : undefined;
  const openCount = runs.filter(isOpen).length;

  /* The task the tracked run is parked on, if a human has to decide. */
  const pendingTask =
    tracked?.status === 'waiting'
      ? taskOrder
          .map((id) => tasks[id])
          .find((task) => task.execId === tracked.id && task.status === 'pending')
      : undefined;

  const decide = (taskId: string) => {
    openTask(taskId);
    navigate('tasks');
  };

  return (
    <div className={styles['tracker']}>
      <span className={styles['label']}>Tracking</span>

      <Tooltip
        label="Execution shown on the diagram"
        description="Node badges belong to this run only. Pick another to replay its state on the same diagram."
        align="start"
      >
        <Dropdown
          size="small"
          value={tracked?.id ?? null}
          options={options}
          onChange={trackExecution}
          placeholder="Nothing tracked"
          aria-label="Execution shown on the diagram"
        />
      </Tooltip>

      {tracked ? <StatusPill value={tracked.status} /> : null}

      {pendingTask ? (
        <Tooltip label="Waiting for your decision" description={pendingTask.title} align="start">
          <button type="button" className={styles['decide']} onClick={() => decide(pendingTask.id)}>
            <Icon name="UserFocus" size="medium" />
            Decide
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
};
