import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type StepStatus = 'incomplete' | 'complete' | 'loading';

interface StepProps {
  title: string;
  description?: string;
  status?: StepStatus;
  icon?: React.ReactNode;
  isLastStep?: boolean;
}

interface StepsProps {
  currentStep: number;
  children: React.ReactNode;
  className?: string;
}

export const Step = ({
  title,
  description,
  status = 'incomplete',
  icon,
  isLastStep = false,
}: StepProps) => {
  return (
    <div className="flex items-start">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2',
            {
              'border-primary bg-primary text-primary-foreground': status === 'complete',
              'border-muted-foreground': status === 'incomplete',
              'border-primary': status === 'loading',
            }
          )}
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : status === 'complete' ? (
            icon || <span className="text-xs font-bold">✓</span>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">•</span>
          )}
        </div>
        {!isLastStep && (
          <div
            className={cn('h-10 w-0.5 bg-border', {
              'bg-primary': status === 'complete',
            })}
          />
        )}
      </div>
      <div className="ml-4 pb-8">
        <p
          className={cn('font-medium', {
            'text-foreground': status === 'complete' || status === 'loading',
            'text-muted-foreground': status === 'incomplete',
          })}
        >
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};

export const Steps = ({ currentStep, children, className }: StepsProps) => {
  // Clone children to add isLastStep prop
  const childrenArray = React.Children.toArray(children);
  const stepsWithProps = childrenArray.map((child, index) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        isLastStep: index === childrenArray.length - 1,
      });
    }
    return child;
  });

  return (
    <div className={cn('flex flex-col', className)}>
      {stepsWithProps}
    </div>
  );
};
