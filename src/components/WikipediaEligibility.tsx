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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendlyEmbed } from '@/components/CalendlyEmbed';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SourcesTab } from '@/components/SourcesTab';

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

  const { eligible, score, hasExistingWikipedia, existingWikipediaUrl, reasons, suggestedAction, sourcesList, categorized, notability, existence } = result;
  const [showSources, setShowSources] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  
  // Define openCalendlyPopup BEFORE it's used
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
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        window.open(
          calendlyUrl,
          'CalendlyPopup',
          `width=${width},height=${height},top=${top},left=${left}`
        );
      }
    } else {
      // Fallback for non-browser environments
      console.log('Calendly scheduling link:', calendlyUrl);
    }
  };

  // Sources that actually clear all four of Wikipedia's gates.
  const qualifyingCount = categorized?.qualifying?.length || 0;
  const supportingCount = categorized?.supporting?.length || 0;
  const rejectedCount = categorized?.rejected?.length || 0;
  const qualifyingDomains = notability?.qualifyingDomains || 0;

  // Handle the case where the topic already has a Wikipedia page.
  // Only a VERIFIED exact-title match from the MediaWiki API reaches this branch.
  if (hasExistingWikipedia && existingWikipediaUrl) {
    return (
      <div className="mb-6">
        <Alert variant="default" className="bg-green-50 border-green-200 mb-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <p className="font-medium text-green-800">
                This topic already has a Wikipedia article
              </p>
              <p className="text-green-700 text-sm mt-1">{existence?.explanation}</p>
              <a
                href={existingWikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 underline text-sm"
              >
                View Wikipedia article
              </a>
            </div>
          </div>
        </Alert>

        {/* New CTA for existing Wikipedia pages */}
        <div className="mt-6 border rounded-md p-4 bg-gray-50">
          <h2 className="text-xl font-medium mb-3">Spotted an issue?</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              If you think this Wikipedia page has any mistakes or outdated information, we might be able to help. 
              Schedule a meeting today to find out more about our ethical editing practices.
            </p>
          </div>
          <div className="mt-4">
            <Button 
              onClick={openCalendlyPopup}
              className="w-full bg-[#17163e] hover:bg-[#232253] text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule a Free Consultation
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-auto">
      <div className="p-4">
        <div className="space-y-4">
          {/* Title and subject, no score here */}
          <div>
            <h3 className="text-xl font-medium">Wikipedia Eligibility Analysis</h3>
            <p className="text-sm text-gray-500">For: {query}</p>
          </div>

          {/* A name-match that could not be confirmed as the same subject. */}
          {existence?.status === 'ambiguous' && (
            <Alert variant="default" className="bg-amber-50 border-amber-200">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Possible existing article — needs checking</p>
                  <p className="text-amber-700 text-sm mt-1">{existence.explanation}</p>
                  <ul className="mt-2 space-y-1">
                    {existence.candidates.map((c, i) => (
                      <li key={i}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-800 underline text-sm"
                        >
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Alert>
          )}

          <div className="space-y-3">
            {/* Status, Analysis and Score on one line */}
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              {/* Left: Status - With color coding */}
              <div className="flex items-center mr-2 min-w-[120px]">
                {/* Icon already has appropriate colors */}
                {eligible ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                ) : score > 40 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                )}
                <div>
                  <h3 className={`font-medium whitespace-nowrap ${
                    eligible 
                      ? "text-green-600" 
                      : score > 40 
                        ? "text-amber-500" 
                        : "text-red-500"
                  }`}>
                    {eligible ? "Eligible" : score > 40 ? "Potentially Eligible" : "Not Eligible"}
                  </h3>
                </div>
              </div>
              
              {/* Middle: what the sources actually show */}
              <div className="text-sm text-gray-700 flex-grow px-2">
                <span className="text-gray-700">{notability?.verdict}</span>
                {rejectedCount > 0 && (
                  <span className="text-gray-500">
                    {' '}
                    {rejectedCount} of {sourcesList.length} sources found were excluded as
                    non-independent or unreliable.
                  </span>
                )}
              </div>

              {/* Right: Score - WITH TOOLTIP */}
              <div className="flex flex-col items-center justify-center min-w-[60px] ml-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <div className="font-bold text-xl">{Math.round(score)}</div>
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white p-2 shadow-lg rounded-md border max-w-xs">
                      <p className="text-sm">
                        The score reflects how many independent, reliable sources cover this
                        subject in depth. Eligibility requires <strong>66+</strong> and qualifying
                        coverage from at least <strong>three different publishers</strong>.
                        Currently: {qualifyingCount} qualifying source
                        {qualifyingCount === 1 ? '' : 's'} across {qualifyingDomains} publisher
                        {qualifyingDomains === 1 ? '' : 's'}.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="text-xs text-gray-500 mt-1">
                  {eligible ? "Eligible" : score >= 55 ? "Borderline" : "Not Eligible"}
                </div>
              </div>
            </div>
            
            {/* Call to action when not eligible */}
            {!eligible && !hasExistingWikipedia && (
              <div className="mt-6 border rounded-md p-4 bg-gray-50">
                {/* Display the heading and text directly instead of in a dialog */}
                <div className="mb-4">
                  <h2 className="text-xl font-medium mb-3">
                    {score >= 65 ? (
                      <>You Could be Eligible for a Wikipedia Page</>
                    ) : score >= 45 ? (
                      <>You're Close — But Not Quite There</>
                    ) : (
                      <>You're Not Ready (Yet)</>
                    )}
                  </h2>
                  
                  {score < 45 ? (
                    <div className="space-y-3 text-sm text-gray-600 text-left">
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
                  ) : score < 65 ? (
                    <div className="space-y-3 text-sm text-gray-600 text-left">
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
                    <div className="space-y-3 text-sm text-gray-600 text-left">
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
                    {score >= 65 ? (
                      <>Schedule a Free Consultation</>
                    ) : score >= 45 ? (
                      <>Book a Free Consultation</>
                    ) : (
                      <>Book a Free Call</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Add these two components to export the tab contents separately
export function SourcesAnalysisTab({ result }: { result: WikipediaEligibilityResult }) {
  if (!result?.categorized) return null;
  return <SourcesTab categorized={result.categorized} notability={result.notability} />;
}

export function WikipediaDraftTab({ /* props */ }) {
  return (
    <div>
      {/* Your Wikipedia draft content */}
      <p>Draft content here...</p>
    </div>
  );
} 