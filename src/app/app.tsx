import { WorkflowBuilder } from '@workflowbuilder/sdk';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { useProfileTheme } from '@/config/use-profile-theme';
import { setNodeIndex } from '@/plugins/provenance';
import { configureRun, startRun } from '@/run/engine';
import { useRunStore } from '@/run/store';
import { ConfigStudio } from '@/studio/config-studio';
import { ExecutionsView } from '@/views/executions-view/executions-view';
import { TasksView } from '@/views/tasks-view/tasks-view';
import { INTEGRATION, PLUGINS } from '@/wb/runtime';

import styles from './app.module.css';

import { AppBar } from './app-bar/app-bar';
import { BuilderFocus } from './builder-focus/builder-focus';
import { RunTracker } from './run-tracker/run-tracker';
import { navigate, useHashRoute } from './use-hash-route';
import { useProfileRuntime } from './use-profile-runtime';

export const App = () => {
  const { profiles, profileId, profile, runtime, error, switchProfile, applyPaletteEdit } =
    useProfileRuntime();

  const [studioOpen, setStudioOpen] = useState(false);
  const route = useHashRoute();
  const pendingTasks = useRunStore(
    (state) =>
      state.taskOrder.filter(
        (id) => state.tasks[id].status === 'pending' && state.tasks[id].profileId === profileId,
      ).length,
  );

  useProfileTheme(profile?.theme);

  useEffect(() => {
    if (profile?.chrome.documentTitle) document.title = profile.chrome.documentTitle;
  }, [profile?.chrome.documentTitle]);

  useEffect(() => {
    if (runtime) setNodeIndex(runtime.nodeIndex);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime?.nodeIndex]);

  useEffect(() => {
    configureRun(profileId ?? '', profile?.taskFields, profile?.run?.context);
  }, [profileId, profile?.taskFields, profile?.run?.context]);

  useEffect(() => {
    useRunStore.getState().trackNewestFor(profileId ?? '');
  }, [profileId]);

  if (error) {
    return (
      <div className={clsx(styles['boot'], styles['boot--error'])}>
        <h1>The config backend did not answer</h1>
        <p>{error}</p>
        <p className={styles['boot-hint']}>
          The editor is configured over HTTP by <code>GET /api/profiles.json</code>. Check the Vite
          middleware in <code>vite-plugins/config-api.ts</code>.
        </p>
      </div>
    );
  }

  if (!runtime || !profile) {
    return <div className={styles['boot']}>Loading editor configuration…</div>;
  }

  const onBuilder = route === 'builder';

  const run = () => {
    startRun(runtime.name);
  };

  return (
    <div className={styles['app']}>
      <WorkflowBuilder.Root
        key={runtime.rootKey}
        name={runtime.name}
        layoutDirection={runtime.layoutDirection}
        nodeTypes={runtime.nodeTypes}
        initialNodes={runtime.initialNodes}
        initialEdges={runtime.initialEdges}
        plugins={PLUGINS}
        jsonForm={runtime.jsonForm}
        integration={INTEGRATION}
      >
        <div className={styles['shell']}>
          <div
            className={clsx(styles['canvas'], { [styles['is-parked']]: !onBuilder })}
            aria-hidden={!onBuilder}
          >
            <WorkflowBuilder.Canvas />
          </div>

          <div className={styles['chrome']}>
            <div className={styles['header']}>
              <AppBar
                profiles={profiles}
                profileId={profileId}
                chrome={profile.chrome}
                route={route}
                studioOpen={studioOpen}
                pendingTasks={pendingTasks}
                onNavigate={navigate}
                onSwitchProfile={switchProfile}
                onToggleStudio={() => setStudioOpen((open) => !open)}
                onRun={run}
              />
            </div>

            <BuilderFocus active={onBuilder} />

            <div className={styles['stage']}>
              <div
                className={clsx(styles['panels'], { [styles['is-parked']]: !onBuilder })}
                aria-hidden={!onBuilder}
              >
                <aside className={styles['palette']}>
                  <WorkflowBuilder.Palette />
                </aside>

                <div className={styles['middle']}>
                  <RunTracker profileId={profile.id} />
                  <div id="viewport-bounds" className={styles['viewport-bounds']} />
                </div>

                <aside className={styles['properties']}>
                  <WorkflowBuilder.PropertiesPanel />
                </aside>
              </div>

              {onBuilder ? null : (
                <div className={styles['view']}>
                  {route === 'tasks' ? (
                    <TasksView profileId={profile.id} summary={profile.run?.summary ?? []} />
                  ) : null}
                  {route === 'executions' ? <ExecutionsView profileId={profile.id} /> : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </WorkflowBuilder.Root>

      {studioOpen ? (
        <ConfigStudio
          profile={profile}
          onApplyPalette={applyPaletteEdit}
          onClose={() => setStudioOpen(false)}
        />
      ) : null}
    </div>
  );
};
