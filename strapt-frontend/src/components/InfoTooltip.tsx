import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  iconSize?: number;
}

/**
 * A reusable tooltip component with an info icon
 */
const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  side = 'top',
  className = '',
  iconSize = 16
}) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <HelpCircle 
            className={`text-muted-foreground hover:text-primary cursor-help inline-block ${className}`} 
            size={iconSize} 
          />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InfoTooltip;
