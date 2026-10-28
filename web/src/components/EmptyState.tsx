import type { ReactNode } from 'react';
import Icon from './Icon';

export default function EmptyState({ title, desc, icon = 'spark', children }: {
  title: string;
  desc?: string;
  icon?: 'spark' | 'doc' | 'mic' | 'gear';
  children?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      <div className="empty-mark" aria-hidden="true"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}