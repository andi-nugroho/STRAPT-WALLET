import React, { Suspense, lazy, ComponentType } from 'react';
import { Loading } from '@/components/ui/loading';

interface LazyLoadProps {
  component: () => Promise<{ default: ComponentType<any> }>;
  props?: Record<string, any>;
  fallback?: React.ReactNode;
}

/**
 * LazyLoad component for dynamically importing and rendering components
 * @param component Function that returns a dynamic import
 * @param props Props to pass to the loaded component
 * @param fallback Fallback UI to show while loading
 */
export const LazyLoad: React.FC<LazyLoadProps> = ({
  component,
  props = {},
  fallback = <Loading text="Loading component..." />,
}) => {
  const LazyComponent = lazy(component);

  return (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Create a lazy-loaded component
 * @param importFunc Function that returns a dynamic import
 * @returns Lazy-loaded component
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);
  
  const WrappedComponent = (props: React.ComponentProps<T>) => (
    <Suspense fallback={<Loading text="Loading component..." />}>
      <LazyComponent {...props} />
    </Suspense>
  );
  
  return WrappedComponent;
}

// Example usage:
// const LazyHomeComponent = createLazyComponent(() => import('@/pages/Home'));
