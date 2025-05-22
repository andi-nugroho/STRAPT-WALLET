import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
}

/**
 * OptimizedImage component with lazy loading, error handling, and loading states
 */
const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ 
    src, 
    alt, 
    width, 
    height, 
    className, 
    fallback, 
    loadingComponent, 
    onLoad, 
    onError,
    priority = false,
    ...props 
  }, ref) => {
    const [isLoading, setIsLoading] = useState(!priority);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const combinedRef = useCombinedRefs(ref, imgRef);
    
    // Set up intersection observer for lazy loading
    useEffect(() => {
      if (priority) return;
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current) {
            // Set the src attribute when the image enters the viewport
            imgRef.current.src = src;
            observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '200px', // Start loading when image is 200px from viewport
      });
      
      if (imgRef.current) {
        observer.observe(imgRef.current);
      }
      
      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
      };
    }, [src, priority]);
    
    const handleLoad = () => {
      setIsLoading(false);
      onLoad?.();
    };
    
    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    };
    
    // Default fallback component
    const defaultFallback = (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
        style={{ width, height }}
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    );
    
    // Default loading component
    const defaultLoadingComponent = (
      <Skeleton 
        className={cn("rounded-md", className)}
        style={{ width, height }}
      />
    );
    
    if (hasError) {
      return <>{fallback || defaultFallback}</>;
    }
    
    return (
      <>
        {isLoading && (loadingComponent || defaultLoadingComponent)}
        <img
          ref={combinedRef}
          src={priority ? src : ''}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            isLoading ? 'hidden' : 'block',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          {...props}
        />
      </>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

// Helper function to combine refs
function useCombinedRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return React.useCallback((element: T) => {
    refs.forEach((ref) => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(element);
      } else {
        (ref as React.MutableRefObject<T>).current = element;
      }
    });
  }, [refs]);
}

export { OptimizedImage };
