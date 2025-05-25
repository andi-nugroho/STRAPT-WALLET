# STRAPT Frontend Performance Optimizations

This document outlines the performance optimizations implemented in the STRAPT frontend codebase to improve loading times, reduce bundle size, and enhance overall user experience.

## Table of Contents

1. [Image Optimizations](#image-optimizations)
2. [Code Splitting and Lazy Loading](#code-splitting-and-lazy-loading)
3. [Data Fetching and Caching](#data-fetching-and-caching)
4. [Component Rendering Optimizations](#component-rendering-optimizations)
5. [Bundle Size Optimizations](#bundle-size-optimizations)
6. [Performance Monitoring](#performance-monitoring)

## Image Optimizations

### OptimizedImage Component

We've created a reusable `OptimizedImage` component that implements several best practices:

- **Lazy Loading**: Images are only loaded when they enter the viewport
- **Proper Sizing**: Images are sized appropriately for their container
- **Loading States**: Shows loading skeletons while images are loading
- **Error Handling**: Provides fallbacks for failed image loads

```tsx
// Example usage
import { OptimizedImage } from '@/components/ui/optimized-image';

function MyComponent() {
  return (
    <OptimizedImage
      src="/path/to/image.jpg"
      alt="Description"
      width={300}
      height={200}
      priority={false} // Set to true for above-the-fold images
    />
  );
}
```

### QR Code Optimization

The QR code component has been optimized to:

- **Memoize Calculations**: Prevent unnecessary recalculations
- **Render Options**: Support both canvas and image rendering
- **Responsive Sizing**: Automatically adjust size based on device

## Code Splitting and Lazy Loading

### Route-Based Code Splitting

All page components are now lazy-loaded using React's `lazy` and `Suspense`:

```tsx
// In App.tsx
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}
```

### LazyLoad Component

A reusable `LazyLoad` component has been created for dynamically importing components:

```tsx
// Example usage
import { LazyLoad } from '@/components/LazyLoad';

function MyComponent() {
  return (
    <LazyLoad
      component={() => import('@/components/HeavyComponent')}
      props={{ foo: 'bar' }}
    />
  );
}
```

## Data Fetching and Caching

### Cached Fetch Hook

The `useCachedFetch` hook implements:

- **Response Caching**: Cache responses to reduce API calls
- **Request Deduplication**: Prevent duplicate requests
- **Automatic Revalidation**: Refresh data when needed
- **Error Handling**: Standardized error handling

```tsx
// Example usage
import { useCachedFetch } from '@/hooks/useCachedFetch';

function MyComponent() {
  const { data, error, isLoading } = useCachedFetch('/api/data', {
    cacheTime: 60000, // 1 minute
    deduplicate: true,
    revalidateOnFocus: true,
  });
  
  // Use data, handle loading and error states
}
```

### Cached Contract Read Hook

The `useCachedContractRead` hook optimizes blockchain interactions:

- **Response Caching**: Cache contract read results
- **Request Deduplication**: Prevent duplicate contract calls
- **Polling Optimization**: Smart polling intervals
- **Error Handling**: Standardized error handling

```tsx
// Example usage
import { useCachedContractRead } from '@/hooks/useCachedContractRead';

function MyComponent() {
  const { data, error, isLoading } = useCachedContractRead({
    contractAddress: '0x...',
    abi: MyContractABI,
    functionName: 'balanceOf',
    args: [address],
    cacheTime: 30000, // 30 seconds
  });
  
  // Use data, handle loading and error states
}
```

## Component Rendering Optimizations

### Memoization Utilities

Several memoization utilities have been implemented:

- **useDeepMemo**: Memoize values with deep equality checks
- **useDeepCallback**: Memoize callbacks with deep equality checks for dependencies
- **createMemoComponent**: Create memoized components with custom equality functions
- **deepMemo**: Memoize components with deep equality checks

```tsx
// Example usage
import { useDeepMemo, deepMemo } from '@/lib/memoization';

function MyComponent({ complexData }) {
  // Memoize complex data with deep equality check
  const memoizedData = useDeepMemo(complexData);
  
  // Rest of component
}

// Create a memoized component with deep equality check
export default deepMemo(MyComponent);
```

### Performance Monitoring

The `performance.ts` utility provides tools for monitoring component performance:

- **measureRenderTime**: Measure component render time
- **withPerformanceMonitoring**: HOC for monitoring component performance
- **measureExecutionTime**: Measure function execution time

```tsx
// Example usage
import { withPerformanceMonitoring } from '@/lib/performance';

function MyComponent(props) {
  // Component implementation
}

export default withPerformanceMonitoring(MyComponent, {
  name: 'MyComponent',
  logProps: true,
  logRenderTime: true,
});
```

## Bundle Size Optimizations

### Dynamic Imports

Dynamic imports are used for large dependencies that aren't needed immediately:

```tsx
// Example
const handleSpecialAction = async () => {
  // Only load the library when needed
  const { specialFunction } = await import('large-library');
  specialFunction();
};
```

### Tree Shaking

Imports have been optimized to enable better tree shaking:

```tsx
// Bad (imports everything)
import lodash from 'lodash';

// Good (only imports what's needed)
import { debounce, throttle } from 'lodash-es';
```

## Performance Monitoring

To monitor the performance of these optimizations:

1. Use the Chrome DevTools Performance tab to record and analyze performance
2. Check the Network tab to verify caching is working correctly
3. Use the Coverage tab to identify unused JavaScript and CSS
4. Monitor the console for performance warnings from our monitoring utilities

## Future Improvements

- Implement server-side rendering for critical pages
- Add service worker for offline support and caching
- Implement HTTP/2 server push for critical resources
- Add automated performance testing in CI/CD pipeline
