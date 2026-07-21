import type { ReactNode } from 'react';

interface Props {
  visible: boolean;
  children: ReactNode;
}

export default function RevealSection({ visible, children }: Props) {
  return (
    <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      {children}
    </div>
  );
}
