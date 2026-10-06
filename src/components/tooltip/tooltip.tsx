import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './tooltip.module.css';

type Props = {
  label: string;
  description?: string;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
};

export const Tooltip = ({ label, description, align = 'center', children }: Props) => {
  return (
    <div className={clsx(styles['tooltip'], styles[`tooltip--${align}`])} data-tooltip>
      {children}
      <span className={clsx(styles['pop'], styles['arrow'])} data-tooltip-pop aria-hidden="true" />
      <span
        className={clsx(styles['pop'], styles['bubble'], 'wb-text-label-s')}
        data-tooltip-pop
        aria-hidden="true"
      >
        <span className={styles['name']}>{label}</span>
        {description ? <span className={styles['detail']}>{description}</span> : null}
      </span>
    </div>
  );
};
