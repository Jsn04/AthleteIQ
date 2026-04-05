import React from 'react';

const Skeleton = ({ className }) => (
  <div
    className={`rounded-xl ${className}`}
    style={{
      background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }}
  />
);

export const SkeletonStyle = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `}</style>
);

const LoadingSkeleton = ({ type }) => {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6 w-full">
        <SkeletonStyle />
        {/* stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        {/* athlete cards */}
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-10 w-16 rounded-xl" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-16" />)}
              </div>
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="space-y-5 w-full">
        <SkeletonStyle />
        {/* header */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <div className="flex items-center gap-4 mb-5">
            <Skeleton className="w-16 h-16 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
        {/* chart */}
        <Skeleton className="h-64" />
        {/* logs */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  if (type === 'athlete-list') {
    return (
      <div className="space-y-4 w-full">
        <SkeletonStyle />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'sport-dashboard') {
    return (
      <div className="space-y-6 w-full">
        <SkeletonStyle />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'session-planner') {
    return (
      <div className="space-y-5 w-full">
        <SkeletonStyle />
        <Skeleton className="h-32" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <SkeletonStyle />
      <Skeleton className="h-20 w-full" />
    </>
  );
};

export default LoadingSkeleton;