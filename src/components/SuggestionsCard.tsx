
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, LightbulbIcon } from "lucide-react";

interface SuggestionsCardProps {
  suggestions: string[];
  className?: string;
}

const SuggestionsCard: React.FC<SuggestionsCardProps> = ({
  suggestions,
  className,
}) => {
  return (
    <Card className={cn("overflow-hidden animate-slide-in", className)}>
      <CardHeader className="pb-2 flex flex-row items-center space-x-2">
        <LightbulbIcon className="h-5 w-5 text-amber-500" />
        <CardTitle className="text-base font-medium">Improvement Suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start space-x-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default SuggestionsCard;
