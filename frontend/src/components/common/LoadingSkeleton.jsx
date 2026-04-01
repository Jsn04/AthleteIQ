import React from 'react';

const Skeleton = ({ className }) => (
  <div className={`bg-gray-800/40 border border-white/5 animate-shimmer rounded-xl ${className}`}
    style={{
      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)',
      backgroundSize: '200% 100%',
    }}
  />
);

const LoadingSkeleton = ({ type }) => {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return <Skeleton className="h-20 w-full" />;
};

export default LoadingSkeleton;
