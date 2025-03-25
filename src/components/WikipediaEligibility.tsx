import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { WikipediaEligibilityResult, AnalyzedSource } from '@/utils/wikipediaEligibility';
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, BookOpen, InfoIcon, ChevronDown, ChevronUp, HelpCircle, ChevronRight, Calendar } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WikipediaEligibilityProps {
  result: WikipediaEligibilityResult;
  query: string;
}

export function WikipediaEligibility({ result, query }: WikipediaEligibilityProps) {
  // Guard clause to handle null or undefined result
  if (!result) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-gray-500">Enter a search query to analyze Wikipedia eligibility.</p>
      </div>
    );
  }

  const { eligible, score, hasExistingWikipedia, existingWikipediaUrl, reasons, suggestedAction, reliableSources, sourcesList } = result;
  const [showSources, setShowSources] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  
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
  
  // First, update the groupedSources object to include unknown/no consensus sources
  const groupedSources = {
    highlyReliable: result.sourcesList.filter(s => s.category === 'highlyReliable'),
    moderatelyReliable: result.sourcesList.filter(s => s.category === 'moderatelyReliable'),
    unreliable: result.sourcesList.filter(s => s.category === 'unreliable'),
    deprecated: result.sourcesList.filter(s => s.category === 'deprecated'),
    noConsensus: result.sourcesList.filter(s => !['highlyReliable', 'moderatelyReliable', 'unreliable', 'deprecated'].includes(s.category))
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
  
  // Update the openCalendlyPopup function to ensure it works reliably
  const openCalendlyPopup = () => {
    // Direct URL approach as backup
    const calendlyUrl = 'https://calendly.com/orani/30min';
    
    // Try using the Calendly API if available
    if (typeof window !== 'undefined') {
      if (window.Calendly && typeof window.Calendly.initPopupWidget === 'function') {
        window.Calendly.initPopupWidget({
          url: calendlyUrl
        });
      } else {
        // Direct popup if Calendly API is not available
        const width = 1000;
        const height = 750;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        window.open(
          calendlyUrl,
          'Calendly',
          `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );
      }
    }
  };
  
  return (
    <div className="space-y-3">
      {/* Status and Score */}
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <div className="flex items-center">
          {result.eligible ? (
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          ) : result.score > 40 ? (
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
          ) : (
            <XCircle className="h-5 w-5 text-gray-500 mr-2" />
          )}
          <div>
            <h3 className="font-medium">
              {result.eligible ? "Eligible" : result.score > 40 ? "Potentially Eligible" : "Not Eligible"}
            </h3>
            <p className="text-xs text-gray-600">
              {result.suggestedAction}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center">
          <div>
            <div className="text-xs text-gray-600">Score</div>
            <div className="font-bold text-xl">{Math.round(result.score)}</div>
          </div>
        </div>
      </div>
      
      {/* Score explanation - NEW */}
      <div className="mt-4 mb-2 text-sm border-t border-b py-3">
        <h4 className="font-medium mb-1">Analysis Summary</h4>
        <p className="text-gray-700">
          {result.eligible ? (
            <>
              <span className="text-green-600 font-medium">Strong Wikipedia potential. </span>
              Found {groupedSources.highlyReliable.length} reliable and {groupedSources.moderatelyReliable.length} moderately 
              reliable sources, providing sufficient third-party coverage to establish notability.
            </>
          ) : result.score > 65 ? (
            <>
              <span className="text-amber-600 font-medium">Good potential but needs refinement. </span>
              Found {groupedSources.highlyReliable.length} reliable sources, which is promising, but Wikipedia editors typically 
              look for additional high-quality, independent coverage to establish clear notability.
            </>
          ) : result.score > 40 ? (
            <>
              <span className="text-amber-600 font-medium">Shows potential but needs more coverage. </span>
              Your topic has some third-party coverage with {reliableSourcesCount} reliable or moderate sources, 
              but would benefit from additional high-quality sources from established publications.
            </>
          ) : (
            <>
              <span className="text-gray-600 font-medium">Currently limited coverage. </span>
              Found {reliableSourcesCount} reliable or moderate sources discussing this topic, 
              which is below the typical threshold for Wikipedia notability. Focus on gaining more 
              coverage from established publications.
            </>
          )}
        </p>
      </div>
      
      {/* Call to action when not eligible */}
      {!result.eligible && !result.hasExistingWikipedia && (
        <div className="mt-6 border rounded-md p-4 bg-gray-50">
          {/* Display the heading and text directly instead of in a dialog */}
          <div className="mb-4">
            <h2 className="text-xl font-medium mb-3">
              {result.score >= 65 ? (
                <>You Could be Eligible for a Wikipedia Page</>
              ) : result.score >= 45 ? (
                <>You're Close — But Not Quite There</>
              ) : (
                <>You're Not Ready (Yet)</>
              )}
            </h2>
            
            {result.score < 45 ? (
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Wikipedia only allows pages about topics that meet its strict standards for notability and credibility. 
                  Right now, the available sources and public footprint around your name or brand aren't quite strong enough.
                </p>
                <p>
                  But here's the good news: you can build that credibility. With the right strategy—media coverage, 
                  high-authority citations, and a strong digital footprint—you can get there.
                </p>
                <p className="font-medium">
                  Book a free call to discuss how we can boost your online presence, credibility, 
                  and reputation—so you're ready for Wikipedia when it counts.
                </p>
              </div>
            ) : result.score < 65 ? (
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  You're on the right track. Your subject shows some signs of notability, but it needs a stronger 
                  foundation to meet Wikipedia's standards. A few more high-quality media mentions or third-party 
                  sources could make all the difference.
                </p>
                <p className="font-medium">
                  Book a free consultation and we'll show you how to build up your credibility, 
                  fill in the missing gaps, and get closer to Wikipedia eligibility without wasting time or money.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Your topic appears to meet the credibility and sourcing requirements Wikipedia editors look for. 
                  That's a strong position to be in—congrats.
                </p>
                <p className="font-medium">
                  Book a quick call to go over next steps. We'll help you fine-tune your narrative, 
                  identify the best sources to cite, and ensure you approach the process the right way—from draft to approval.
                </p>
              </div>
            )}
          </div>

          {/* Add the button to open Calendly popup */}
          <div className="mt-4">
            <Button 
              onClick={openCalendlyPopup}
              className="w-full bg-[#17163e] hover:bg-[#232253] text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {result.score >= 65 ? (
                <>Schedule a Free Consultation</>
              ) : result.score >= 45 ? (
                <>Book a Free Consultation</>
              ) : (
                <>Book a Free Call</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 