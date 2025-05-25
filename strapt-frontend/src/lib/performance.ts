/**
 * Performance utilities for React components
 */

import React from "react";

/**
 * Measure component render time
 * @param componentName Name of the component
 * @param callback Function to measure
 * @returns Result of the callback
 */
export function measureRenderTime<T>(componentName: string, callback: () => T): T {
  if (process.env.NODE_ENV === 'development') {
    const startTime = performance.now();
    const result = callback();
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Log render time if it's above 16ms (60fps)
    if (renderTime > 16) {
      console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
    }
    
    return result;
  }
  
  return callback();
}

/**
 * Create a performance wrapper for a component
 * @param Component The component to wrap
 * @param options Options for the wrapper
 * @returns Wrapped component with performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    name?: string;
    logProps?: boolean;
    logRenderTime?: boolean;
  } = {}
): React.FC<P> {
  const {
    name = Component.displayName || Component.name || 'Component',
    logProps = false,
    logRenderTime = true,
  } = options;
  
  const PerformanceComponent: React.FC<P> = (props) => {
    if (process.env.NODE_ENV === 'development') {
      if (logProps) {
        console.log(`[Props] ${name}:`, props);
      }
      
      if (logRenderTime) {
        return measureRenderTime(name, () => React.createElement(Component, props));
      }
    }
    
    return React.createElement(Component, props);
  };
  
  PerformanceComponent.displayName = `Performance(${name})`;
  
  return PerformanceComponent;
}

/**
 * Measure execution time of a function
 * @param name Name of the function
 * @param fn Function to measure
 * @returns Wrapped function with performance monitoring
 */
export function measureExecutionTime<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  if (process.env.NODE_ENV === 'production') {
    return fn;
  }
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const startTime = performance.now();
    const result = fn(...args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result.then((value) => {
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Log execution time if it's above 100ms
        if (executionTime > 100) {
          console.warn(`[Performance] ${name} took ${executionTime.toFixed(2)}ms to execute`);
        }
        
        return value;
      }) as ReturnType<T>;
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Log execution time if it's above 16ms
    if (executionTime > 16) {
      console.warn(`[Performance] ${name} took ${executionTime.toFixed(2)}ms to execute`);
    }
    
    return result;
  }) as T;
}

/**
 * Check if the browser supports the Performance API
 * @returns Boolean indicating if Performance API is supported
 */
export function isPerformanceSupported(): boolean {
  return typeof performance !== 'undefined' && 
         typeof performance.now === 'function' && 
         typeof performance.mark === 'function' && 
         typeof performance.measure === 'function';
}

/**
 * Measure a specific performance metric
 * @param name Name of the metric
 * @param callback Function to measure
 * @returns Result of the callback
 */
export function measurePerformance<T>(name: string, callback: () => T): T {
  if (!isPerformanceSupported() || process.env.NODE_ENV === 'production') {
    return callback();
  }
  
  const startMark = `${name}_start`;
  const endMark = `${name}_end`;
  const measureName = name;
  
  performance.mark(startMark);
  const result = callback();
  performance.mark(endMark);
  
  performance.measure(measureName, startMark, endMark);
  
  // Log the measurement
  const entries = performance.getEntriesByName(measureName);
  if (entries.length > 0) {
    const duration = entries[0].duration;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  // Clean up marks
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(measureName);
  
  return result;
}
