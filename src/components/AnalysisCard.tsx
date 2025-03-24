
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle } from "lucide-react";

interface AnalysisCardProps {
  title: string;
  score: number;
  description: string;
  className?: string;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({
  title,
  score,
  description,
  className,
}) => {
  // Determine status based on score
  const status = score >= 0.7 ? "success" : score >= 0.4 ? "warning" : "error";
  
  const statusColor = {
    success: "text-green-500",
    warning: "text-amber-500",
    error: "text-red-500",
  };
  
  const statusIcon = {
    success: <CheckCircle className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
  };
  
  const scorePercentage = Math.round(score * 100);

  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md animate-scale-in", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className={cn("font-medium", statusColor[status])}>
              {scorePercentage}%
            </span>
            <span className={statusColor[status]}>{statusIcon[status]}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
};

export default AnalysisCard;
