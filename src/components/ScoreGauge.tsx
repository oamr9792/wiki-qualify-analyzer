
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = "md",
  className,
  showPercentage = true,
  animated = true,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  useEffect(() => {
    if (animated) {
      const timeout = setTimeout(() => {
        setDisplayScore(score);
      }, 300);
      
      return () => clearTimeout(timeout);
    } else {
      setDisplayScore(score);
    }
  }, [score, animated]);
  
  const scorePercentage = Math.round(displayScore * 100);
  
  // Determine color based on score
  const getColor = () => {
    if (score >= 0.7) return "text-green-500";
    if (score >= 0.4) return "text-amber-500";
    return "text-red-500";
  };
  
  // Determine size
  const sizeClasses = {
    sm: {
      container: "w-16 h-16",
      text: "text-xl",
      thickness: "stroke-[8px]",
    },
    md: {
      container: "w-28 h-28",
      text: "text-3xl",
      thickness: "stroke-[10px]",
    },
    lg: {
      container: "w-40 h-40",
      text: "text-4xl",
      thickness: "stroke-[12px]",
    },
  };
  
  // Calculate circle properties
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore * circumference);
  
  return (
    <div className={cn("relative", sizeClasses[size].container, className)}>
      <svg
        className="w-full h-full transform -rotate-90"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="fill-none stroke-muted transition-all duration-300"
          strokeWidth={sizeClasses[size].thickness.replace("stroke-", "")}
        />
        
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          className={cn("fill-none transition-all duration-700 ease-out", getColor(), sizeClasses[size].thickness)}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? offset : 0}
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-semibold transition-all duration-500", sizeClasses[size].text, getColor())}>
            {scorePercentage}%
          </span>
        </div>
      )}
    </div>
  );
};

export default ScoreGauge;
