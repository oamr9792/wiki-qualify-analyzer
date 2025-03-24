
import { cn } from "@/lib/utils";
import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Factor {
  name: string;
  value: number;
}

interface DetailedFactorsProps {
  title: string;
  factors: Factor[];
  className?: string;
}

const DetailedFactors: React.FC<DetailedFactorsProps> = ({
  title,
  factors,
  className,
}) => {
  // Calculate color based on score
  const getColor = (value: number) => {
    if (value >= 0.7) return "bg-green-500";
    if (value >= 0.4) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className={cn("p-4 animate-slide-in", className)}>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="space-y-3">
        {factors.map((factor) => (
          <div key={factor.name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{factor.name}</span>
              <span className="font-medium">{Math.round(factor.value * 100)}%</span>
            </div>
            <Progress 
              value={factor.value * 100} 
              className="h-1.5"
              indicatorClassName={cn("transition-all duration-700", getColor(factor.value))}
            />
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DetailedFactors;
