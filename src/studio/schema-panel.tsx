import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { compileProfile } from '@/config/compile-profile/compile-profile';
import { loadProfilePart } from '@/config/load-profile';
import type { PaletteConfig } from '@/config/types/palette';
import type { EditorProfile } from '@/config/types/profile';

import styles from './studio.module.css';

const PARTS = ['palette', 'workflow', 'theme', 'profile'] as const;
type Part = (typeof PARTS)[number];

type Props = {
  profile: EditorProfile;
  onApplyPalette: (palette: PaletteConfig) => void;
};

export const SchemaPanel = ({ profile, onApplyPalette }: Props) => {
  const [part, setPart] = useState<Part>('palette');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setFailed(false);
    setText('');
    void loadProfilePart(profile.id, part)
      .then((data) => {
        if (!cancelled) setText(JSON.stringify(data, null, 2));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setFailed(true);
        setStatus(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id, part]);

  const apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      setFailed(true);
      setStatus(cause instanceof Error ? cause.message : 'Invalid JSON');
      return;
    }

    const palette = parsed as PaletteConfig;
    if (!Array.isArray(palette?.entries) || palette.entries.length === 0) {
      setFailed(true);
      setStatus('A palette needs a non-empty "entries" array.');
      return;
    }

    try {
      compileProfile({ ...profile, palette });
    } catch (cause) {
      setFailed(true);
      setStatus(cause instanceof Error ? cause.message : String(cause));
      return;
    }

    onApplyPalette(palette);
    setFailed(false);
    setStatus('Applied. The diagram was kept and re-validated against the new schema.');
  };

  return (
    <div className={styles['panel']}>
      <div className={styles['scroll']}>
        <p className={styles['lede']}>
          Straight from{' '}
          <code>
            GET /api/profiles/{profile.id}/{part}.json
          </code>
          . Editing the palette rewrites the node types and their property schemas at runtime.
        </p>

        <div className={styles['subtabs']}>
          {PARTS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={clsx({ [styles['is-active']]: part === entry })}
              onClick={() => setPart(entry)}
            >
              {entry}.json
            </button>
          ))}
        </div>

        <textarea
          className={styles['editor']}
          spellCheck={false}
          value={text}
          readOnly={part !== 'palette'}
          onChange={(event) => setText(event.currentTarget.value)}
        />

        {status ? (
          <p className={clsx(styles['status'], { [styles['is-error']]: failed })}>{status}</p>
        ) : null}
      </div>

      <footer className={styles['footer']}>
        <button type="button" disabled={part !== 'palette'} onClick={apply}>
          Apply
        </button>
      </footer>
      <p className={styles['hint']}>
        {part === 'palette'
          ? 'Try: on approval.human set thresholdAmount’s "minimum" to 5000 — above the 1000 the node already carries — then Apply and select Human Approval.'
          : 'Read-only here — this tab shows what the backend serves.'}
      </p>
    </div>
  );
};
