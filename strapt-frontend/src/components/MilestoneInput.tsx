
import { useState } from 'react';
import { PlusCircle, X, Milestone as MilestoneIcon, Calendar, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InfoTooltip from '@/components/InfoTooltip';

export interface Milestone {
  id: string;
  percentage: number;
  description: string;
  released?: boolean;
}

interface MilestoneInputProps {
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
  duration: number; // total duration in minutes
}

const MilestoneInput = ({ milestones, onChange, duration }: MilestoneInputProps) => {
  const [description, setDescription] = useState('');
  const [percentage, setPercentage] = useState(25);

  const handleAddMilestone = () => {
    if (description.trim() === '') return;

    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      percentage,
      description: description.trim(),
    };

    onChange([...milestones, newMilestone]);
    setDescription('');
    setPercentage(25);
  };

  const handleRemoveMilestone = (id: string) => {
    onChange(milestones.filter(milestone => milestone.id !== id));
  };

  const getTimeForPercentage = (percentage: number) => {
    const minutes = Math.round((percentage / 100) * duration);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <Label className="text-xs">Milestones</Label>
        <InfoTooltip
          content={
            <div>
              <p className="font-medium mb-1">About Milestones</p>
              <p className="mb-1">Milestones let you mark important points in your payment stream.</p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li>Each milestone represents a percentage of the total stream</li>
                <li>Milestones can be released manually by the sender</li>
                <li>Released milestones immediately transfer tokens to the recipient</li>
                <li>Great for project-based work with deliverable checkpoints</li>
              </ul>
            </div>
          }
          iconSize={12}
          className="ml-1"
        />
      </div>

      <div className="p-2 bg-secondary/30 rounded-lg space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Milestone description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-20 relative">
            <Input
              type="number"
              min={1}
              max={99}
              value={percentage}
              onChange={(e) => setPercentage(Number.parseInt(e.target.value, 10) || 25)}
              aria-label="Milestone percentage"
              title="Percentage of total stream amount for this milestone"
              className="h-8 text-xs pr-6"
            />
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddMilestone}
            disabled={!description.trim()}
            className="h-8 w-8 p-0"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>

        {milestones.length > 0 && (
          <div className="max-h-[100px] overflow-y-auto pr-1">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between bg-background p-1.5 rounded text-xs mb-1.5"
              >
                <div className="flex items-center overflow-hidden max-w-[70%]">
                  <MilestoneIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-primary" />
                  <span className="truncate">{milestone.description}</span>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <div className="flex items-center text-muted-foreground mr-1.5">
                    <Calendar className="h-3 w-3 mr-1 hidden sm:inline" />
                    <span className="hidden sm:inline">{getTimeForPercentage(milestone.percentage)}</span>
                    <span className="mx-1">•</span>
                    <span>{milestone.percentage}%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleRemoveMilestone(milestone.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MilestoneInput;
