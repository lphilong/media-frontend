import type { ReactNode } from 'react';

type BlockerBannerProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export const BlockerBanner = ({ title, message, action }: BlockerBannerProps): JSX.Element => {
  return (
    <div className="rounded border border-danger/40 bg-rose-50 px-4 py-3 text-danger">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};
