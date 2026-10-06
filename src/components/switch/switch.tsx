import { Icon } from '@workflowbuilder/sdk';
import clsx from 'clsx';

import styles from './switch.module.css';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'extra-small' | 'small' | 'medium';
  disabled?: boolean;
  required?: boolean;
  error?: string;
  'aria-label'?: string;
};

export const Switch = ({
  checked,
  onChange,
  label,
  size = 'medium',
  disabled = false,
  required = false,
  error,
  'aria-label': ariaLabel,
}: Props) => {
  return (
    <div
      className={clsx(styles['switch'], styles[`switch--${size}`], {
        [styles['is-disabled']]: disabled,
      })}
    >
      <label className={styles['row']}>
        <span className={styles['control']}>
          <input
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          <span className={styles['track']} />
          <span className={styles['thumb']} />
        </span>
        {label ? (
          <span className={clsx(styles['label'], 'wb-text-label-s')}>
            {required ? <Icon name="Asterisk" /> : null}
            {label}
          </span>
        ) : null}
      </label>
      {error ? <p className={styles['error']}>{error}</p> : null}
    </div>
  );
};
