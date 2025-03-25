import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { WikipediaEligibilityResult, AnalyzedSource } from '@/utils/wikipediaEligibility';
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, BookOpen, InfoIcon, ChevronDown, ChevronUp, HelpCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { wikipediaSourceReliability } from '@/utils/wikipediaSourceReliability';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendlyEmbed } from '@/components/CalendlyEmbed';

interface WikipediaEligibilityProps {
  result: WikipediaEligibilityResult;
  query: string;
}

export function WikipediaEligibility({ result, query }: WikipediaEligibilityProps) {
  const { eligible, score, hasExistingWikipedia, existingWikipediaUrl, reasons, suggestedAction, reliableSources, sourcesList } = result;
  const [showSources, setShowSources] = useState(false);
  
  // Helper function to check if domain is in predefined list
  const isInPredefinedList = (domain: string) => {
    return Object.keys(wikipediaSourceReliability).some(key => {
      return domain === key || domain.endsWith(`.${key}`);
    });
  };
  
  // Format reliability category badge
  const formatReliabilityBadge = (source: AnalyzedSource) => {
    switch (source.category) {
      case 'highlyReliable':
        return (
          <Badge variant="success" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1 inline-block" />
            Generally reliable
          </Badge>
        );
      case 'moderatelyReliable':
        return (
          <Badge variant="outline" className="text-xs">
            <HelpCircle className="h-3 w-3 mr-1 inline-block" />
            No consensus
          </Badge>
        );
      case 'unreliable':
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1 inline-block" />
            Generally unreliable
          </Badge>
        );
      case 'deprecated':
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1 inline-block" />
            Deprecated
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            <HelpCircle className="h-3 w-3 mr-1 inline-block" />
            Unknown
          </Badge>
        );
    }
  };
  
  // Group sources by category
  const groupedSources = {
    highlyReliable: result.sourcesList.filter(s => s.category === 'highlyReliable'),
    moderatelyReliable: result.sourcesList.filter(s => s.category === 'moderatelyReliable'),
    unreliable: result.sourcesList.filter(s => s.category === 'unreliable'),
    deprecated: result.sourcesList.filter(s => s.category === 'deprecated')
  };
  
  // At the beginning of the component, calculate the counts consistently
  const reliableSourcesCount = 
    result.sourcesList.filter(s => 
      s.category === 'highlyReliable' || s.category === 'moderatelyReliable'
    ).length;

  const highlyReliableCount = result.sourcesList.filter(s => s.category === 'highlyReliable').length;
  const moderatelyReliableCount = result.sourcesList.filter(s => s.category === 'moderatelyReliable').length;
  
  // Update the component to show a simplified message for existing Wikipedia articles
  if (result.hasExistingWikipedia && result.existingWikipediaUrl) {
    return (
      <div className="mb-6">
        <Alert variant="default" className="bg-green-50 border-green-200">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <p className="font-medium text-green-800">
                This topic already has a Wikipedia article
              </p>
              <a 
                href={result.existingWikipediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-700 underline text-sm"
              >
                View Wikipedia article
              </a>
            </div>
          </div>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex flex-col md:flex-row items-center md:justify-between bg-muted rounded-lg p-4">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="mr-3">
            {result.eligible ? (
              <div className="bg-success/20 text-success rounded-full p-2">
                <CheckCircle className="h-6 w-6" />
              </div>
            ) : result.score > 40 ? (
              <div className="bg-amber-100 text-amber-600 rounded-full p-2">
                <HelpCircle className="h-6 w-6" />
              </div>
            ) : (
              <div className="bg-destructive/20 text-destructive rounded-full p-2">
                <XCircle className="h-6 w-6" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {result.eligible 
                ? "Eligible" 
                : result.score > 40 
                  ? "Potentially Eligible" 
                  : "Not Eligible"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.suggestedAction}
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground mb-1">Eligibility Score</span>
            <div className="w-full md:w-64 flex items-center gap-3">
              <Progress value={result.score} className="h-3 bg-gray-200" />
              <span className="font-medium text-sm">
                {Math.round(result.score)}/100
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Grid with source stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="font-semibold text-green-800">Highly Reliable:</div>
          <div className="text-2xl font-bold text-green-700">
            {Math.round(result.reliableSources.highlyReliable)}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="font-semibold text-blue-800">Moderately Reliable:</div>
          <div className="text-2xl font-bold text-blue-700">
            {Math.round(result.reliableSources.moderatelyReliable)}
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <div className="font-semibold text-red-800">Unreliable:</div>
          <div className="text-2xl font-bold text-red-700">
            {Math.round(result.reliableSources.unreliable)}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
          <div className="font-semibold text-gray-800">Deprecated:</div>
          <div className="text-2xl font-bold text-gray-700">
            {Math.round(result.reliableSources.deprecated)}
          </div>
        </div>
      </div>
      
      {/* Assessment details - enhanced with source information */}
      <div className="bg-muted rounded-lg p-4">
        <h4 className="font-semibold mb-4">Assessment Details</h4>
        
        <Accordion type="single" collapsible className="space-y-2">
          {/* Highly Reliable Sources Section */}
          {groupedSources.highlyReliable.length > 0 && (
            <AccordionItem value="item-1" className="border rounded-md px-2">
              <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-background/50 rounded">
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-success" />
                  Highly reliable sources ({highlyReliableCount})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-8 space-y-1">
                  {groupedSources.highlyReliable.map((source, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {source.domain}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                      {source.citationCount !== undefined && (
                        <span className="text-xs text-gray-500 ml-2 flex items-center">
                          <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-xs font-medium">
                            {source.citationCount} citations
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          
          {/* Moderately Reliable Sources Section */}
          {groupedSources.moderatelyReliable.length > 0 && (
            <AccordionItem value="item-2" className="border rounded-md px-2">
              <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-background/50 rounded">
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-success" />
                  Moderately reliable sources ({moderatelyReliableCount})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-8 space-y-1">
                  {groupedSources.moderatelyReliable.map((source, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {source.domain}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                      {source.citationCount !== undefined && (
                        <span className="text-xs text-gray-500 ml-2 flex items-center">
                          <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-xs font-medium">
                            {source.citationCount} citations
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          
          {/* Unreliable Sources Section */}
          {groupedSources.unreliable.length > 0 && (
            <AccordionItem value="item-3" className="border rounded-md px-2">
              <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-background/50 rounded">
                <span className="flex items-center text-red-700">
                  <XCircle className="h-4 w-4 mr-2" />
                  Found {Math.round(result.reliableSources.unreliable)} sources considered unreliable by Wikipedia
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-8 space-y-1">
                  {groupedSources.unreliable.map((source, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <span className="text-red-600 mr-2">•</span>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {source.domain}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          
          {/* Deprecated Sources Section */}
          {groupedSources.deprecated.length > 0 && (
            <AccordionItem value="item-4" className="border rounded-md px-2">
              <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-background/50 rounded">
                <span className="flex items-center text-gray-700">
                  <XCircle className="h-4 w-4 mr-2" />
                  Found {Math.round(result.reliableSources.deprecated)} deprecated sources
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-8 space-y-1">
                  {groupedSources.deprecated.map((source, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <span className="text-gray-600 mr-2">•</span>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {source.domain}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          
          {/* Other Assessment Reasons */}
          {result.reasons.filter(reason => 
            !reason.includes('highly reliable') && 
            !reason.includes('moderately reliable') && 
            !reason.includes('unreliable') && 
            !reason.includes('deprecated')
          ).length > 0 && (
            <AccordionItem value="item-5" className="border rounded-md px-2">
              <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-background/50 rounded">
                <span className="flex items-center">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Other assessment factors
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-8 space-y-1">
                  {result.reasons
                    .filter(reason => 
                      !reason.includes('highly reliable') && 
                      !reason.includes('moderately reliable') && 
                      !reason.includes('unreliable') && 
                      !reason.includes('deprecated')
                    )
                    .map((reason, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="text-gray-600 mr-2">•</span>
                        {reason}
                      </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
      
      {/* Add Calendly embed at the bottom */}
      <CalendlyEmbed score={result.score} />
    </div>
  );
} 