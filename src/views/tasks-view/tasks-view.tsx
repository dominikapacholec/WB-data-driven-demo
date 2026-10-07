import { Icon } from '@workflowbuilder/sdk';
import clsx from 'clsx';
import { useState } from 'react';

import type { RunSummaryRow } from '@/config/types/profile';
import { formatMoney } from '@/helpers/format-money';
import { resolveTask } from '@/run/engine';
import { type Task, useRunStore } from '@/run/store';
import primitives from '@/styles/primitives.module.css';

import styles from './tasks-view.module.css';

import { StatusPill } from '../status-pill/status-pill';

/** Renders one configured row against the run context. */
const summaryValue = (row: RunSummaryRow, context: Record<string, unknown> | undefined): string => {
  const raw = context?.[row.key];
  if (row.format === 'money') {
    return formatMoney(raw, String(context?.[row.currencyKey ?? ''] ?? 'EUR'));
  }
  if (row.format === 'flag') {
    return raw ? (row.trueText ?? 'Yes') : (row.falseText ?? 'No');
  }
  return raw === undefined || raw === null || raw === '' ? '—' : String(raw);
};

const TaskDetail = ({
  task,
  summary,
  onClose,
}: {
  task: Task;
  summary: RunSummaryRow[];
  onClose: () => void;
}) => {
  const [comment, setComment] = useState('');
  const context = useRunStore((state) => state.executions[task.execId]?.context);
  const pending = task.status === 'pending';

  const decide = (decision: 'approve' | 'reject') => {
    resolveTask(task.id, decision, comment);
    onClose();
  };

  return (
    <section className={primitives['card']}>
      <header className={primitives['card-head']}>
        <div>
          <h2>{task.title}</h2>
          <p className={primitives['card-sub']}>Assigned to {task.assignee}</p>
        </div>
        <StatusPill value={task.status} />
      </header>

      <dl className={styles['summary']}>
        {summary.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd className={row.strong ? styles['summary-strong'] : undefined}>
              {summaryValue(row, context)}
            </dd>
          </div>
        ))}
        <div>
          <dt>Priority</dt>
          <dd>{task.priority}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>within {task.dueAfterHours}h</dd>
        </div>
      </dl>

      {task.reviewerNote ? <p className={styles['note']}>{task.reviewerNote}</p> : null}

      {pending ? (
        <>
          <label className={styles['field']}>
            <span>Comment</span>
            <textarea
              rows={3}
              value={comment}
              placeholder="Optional — it lands in the execution timeline."
              onChange={(event) => setComment(event.currentTarget.value)}
            />
          </label>
          <footer className={primitives['card-actions']}>
            {task.allowReject ? (
              <button
                type="button"
                className={clsx(styles['btn'], styles['btn--danger'])}
                onClick={() => decide('reject')}
              >
                Reject
              </button>
            ) : null}
            <button
              type="button"
              className={clsx(styles['btn'], styles['btn--primary'])}
              onClick={() => decide('approve')}
            >
              Approve
            </button>
          </footer>
        </>
      ) : (
        <p className={primitives['card-sub']}>
          {task.status === 'completed' ? 'Approved' : 'Rejected'}
          {task.comment?.trim() ? ` — “${task.comment.trim()}”` : ''}
        </p>
      )}
    </section>
  );
};

export const TasksView = ({
  profileId,
  summary,
}: {
  profileId: string;
  summary: RunSummaryRow[];
}) => {
  const allTaskIds = useRunStore((state) => state.taskOrder);
  const tasks = useRunStore((state) => state.tasks);
  const openId = useRunStore((state) => state.openTaskId);
  const setOpenId = useRunStore((state) => state.openTask);

  /* Each profile is its own application; it must not see the other's inbox. */
  const taskOrder = allTaskIds.filter((id) => tasks[id].profileId === profileId);
  const open = openId && tasks[openId]?.profileId === profileId ? tasks[openId] : null;

  return (
    <div className={primitives['view']}>
      <header className={primitives['view-head']}>
        <h1>My Tasks</h1>
        <p className={primitives['view-sub']}>
          {taskOrder.filter((id) => tasks[id].status === 'pending').length} waiting for a decision
        </p>
      </header>

      {taskOrder.length === 0 ? (
        <p className={primitives['empty']}>
          <Icon name="Tray" size="medium" />
          No tasks yet. Start a run in the builder — the workflow will pause here.
        </p>
      ) : (
        <div className={primitives['view-split']}>
          <ul className={primitives['list']}>
            {taskOrder.map((id) => {
              const task = tasks[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={clsx(primitives['list-row'], {
                      [primitives['is-open']]: openId === id,
                    })}
                    onClick={() => setOpenId(id)}
                  >
                    <span className={primitives['list-main']}>
                      <strong>{task.title}</strong>
                      <span className={primitives['list-meta']}>
                        {task.assignee} · due within {task.dueAfterHours}h
                      </span>
                    </span>
                    <StatusPill value={task.status} />
                  </button>
                </li>
              );
            })}
          </ul>

          {open ? (
            <TaskDetail task={open} summary={summary} onClose={() => setOpenId(open.id)} />
          ) : (
            <p className={primitives['empty']}>Pick a task to see the invoice and decide.</p>
          )}
        </div>
      )}
    </div>
  );
};
