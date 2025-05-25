import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { isEqual } from 'lodash-es';

/**
 * Deep memoize a value with deep equality check
 * @param value The value to memoize
 * @returns Memoized value
 */
export function useDeepMemo<T>(value: T): T {
  const ref = useRef<T>(value);
  
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  
  return ref.current;
}

/**
 * Deep memoize a callback with deep equality check for dependencies
 * @param callback The callback to memoize
 * @param deps The dependencies array
 * @returns Memoized callback
 */
export function useDeepCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps.map(dep => useDeepMemo(dep)));
}

/**
 * Create a memoized component with custom equality function
 * @param Component The component to memoize
 * @param propsAreEqual Custom equality function for props
 * @returns Memoized component
 */
export function createMemoComponent<T extends React.ComponentType<any>>(
  Component: T,
  propsAreEqual: (prevProps: React.ComponentProps<T>, nextProps: React.ComponentProps<T>) => boolean = isEqual
): T {
  return memo(Component, propsAreEqual) as T;
}

/**
 * Deep memoize a component with deep equality check for props
 * @param Component The component to memoize
 * @returns Memoized component
 */
export function deepMemo<T extends React.ComponentType<any>>(Component: T): T {
  return memo(Component, isEqual) as T;
}

/**
 * Hook to track if a component is mounted
 * @returns Boolean indicating if component is mounted
 */
export function useIsMounted(): boolean {
  const isMounted = useRef(false);
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return isMounted.current;
}

/**
 * Hook to prevent state updates after component unmount
 * @returns Safe setState function
 */
export function useSafeState<T>(initialState: T | (() => T)): [T, (value: React.SetStateAction<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const setSafeState = useCallback((value: React.SetStateAction<T>) => {
    if (isMounted.current) {
      setState(value);
    }
  }, []);
  
  return [state, setSafeState];
}

/**
 * Hook to debounce a value
 * @param value The value to debounce
 * @param delay The debounce delay in ms
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Hook to throttle a value
 * @param value The value to throttle
 * @param limit The throttle limit in ms
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdated.current;
    
    if (elapsed >= limit) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timerId = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, limit - elapsed);
      
      return () => {
        clearTimeout(timerId);
      };
    }
  }, [value, limit]);
  
  return throttledValue;
}
