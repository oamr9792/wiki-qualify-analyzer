import React, { useState, useEffect, useCallback } from 'react';
import { useDataForSeoSearch } from '@/services/dataForSeoService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, AlertCircle, Globe, Info, Search, Newspaper, BookOpen, CheckCircle, XCircle, HelpCircle, Shield, Loader2, Terminal, Calendar } from 'lucide-react';
import { WikipediaEligibility } from '@/components/WikipediaEligibility';
import { assessWikipediaEligibility, WikipediaEligibilityResult } from '@/utils/wikipediaEligibility';
import { getSourceReliability, wikipediaSourceReliability } from '@/utils/wikipediaSourceReliability';
import { CitationCount } from '@/components/CitationCount';
import { getEffectiveDomain } from '@/utils/domainUtils';
import { WikipediaArticleDraft } from '@/components/WikipediaArticleDraft';
import { isSearchAllowed, incrementSearchCount, getRemainingSearches, getTimeUntilReset, getReadableTimeUntilReset } from '@/services/rateLimitService';
import { SourcesTab } from '@/components/SourcesTab';

export function UnifiedSearch() {
  const [query, setQuery] = useState('');
  const [modifierKeyword1, setModifierKeyword1] = useState('');
  const [modifierKeyword2, setModifierKeyword2] = useState('');
  const [activeTab, setActiveTab] = useState('organic');
  const [eligibilityResult, setEligibilityResult] = useState<WikipediaEligibilityResult | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  
  const { 
    results, 
    newsResults, 
    isLoading, 
    error, 
    searchGoogle, 
    rawData,
    totalCount,
    newsCount 
  } = useDataForSeoSearch();

  // Add state to track domains with citation counts
  const [domainCitations, setDomainCitations] = useState<Record<string, number>>({});
  
  // Add state for rate limiting
  const [userIp, setUserIp] = useState<string>('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [remainingSearches, setRemainingSearches] = useState<number>(5);
  
  // Add this to your state declarations at the top of the UnifiedSearch component
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Add this at the top of the UnifiedSearch component
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Add these state variables to your component
  const [loadingStage, setLoadingStage] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Define the loading stages
  const loadingStages = [
    { message: "Initializing search...", duration: 600 },
    { message: "Querying search engines...", duration: 1200 },
    { message: "Analyzing source reliability...", duration: 1500 },
    { message: "Parsing publication data...", duration: 1000 },
    { message: "Evaluating citation metrics...", duration: 1300 },
    { message: "Calculating eligibility score...", duration: 1000 },
    { message: "Generating draft content...", duration: 1400 },
    { message: "Finalizing analysis...", duration: 800 }
  ];

  // Update the handleCitationCount callback
  const handleCitationCount = useCallback((domain: string, count: number) => {
    // Prevent unnecessary state updates by checking if the citation count changed
    setDomainCitations(prev => {
      // Only update if the count is different from what we already have
      if (prev[domain] === count) return prev;
      return {
        ...prev,
        [domain]: count
      };
    });
  }, []);

  // Assess Wikipedia eligibility whenever search results update
  useEffect(() => {
    if (!isLoading && results.length > 0 && searchedQuery) {
      // Debug logging
      console.log(`Results found: ${results.length} organic, ${newsResults.length} news`);
      console.log("Checking for Wikipedia article in results:");
      
      // RESTORE THE ORIGINAL WIKIPEDIA CHECK LOGIC
      const wikipediaResult = [...results, ...newsResults].find(r => 
        r.url.includes('wikipedia.org/wiki/') && 
        !r.url.includes('wikipedia.org/wiki/Category:') &&
        !r.url.includes('wikipedia.org/wiki/Wikipedia:') &&
        !r.url.includes('wikipedia.org/wiki/Template:') &&
        !r.url.includes('wikipedia.org/wiki/Help:') &&
        !r.url.includes('wikipedia.org/wiki/Portal:') &&
        !r.url.includes('wikipedia.org/wiki/Talk:') &&
        !r.url.includes('wikipedia.org/wiki/File:')
      );
      
      if (wikipediaResult) {
        console.log("Wikipedia article found:", wikipediaResult.url);
      } else {
        console.log("No Wikipedia article found in results");
      }
      
      // Pass domainCitations to the assessment function
      const assessment = assessWikipediaEligibility(searchedQuery, results, newsResults, domainCitations);
      console.log("Eligibility assessment:", assessment);
      setEligibilityResult(assessment);
    }
  }, [isLoading, results, newsResults, domainCitations, searchedQuery]);

  // Fix the useEffect that gets the user IP and checks admin mode
  useEffect(() => {
    const getUserIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setUserIp(data.ip);
        setRemainingSearches(getRemainingSearches());
      } catch (error) {
        console.error('Error fetching IP:', error);
        // If we can't get the IP, assume it's not the unlimited IP
        setUserIp('unknown');
      }
    };
    
    // Check for admin mode from query parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const adminMode = urlParams.get('admin') === 'true';
    // Move this declaration up so it's accessible throughout the function
    const storedAdminMode = localStorage.getItem('wikiAnalyzerAdminMode') === 'true';
    
    if (adminMode) {
      // Set admin mode and store in localStorage
      setIsAdminMode(true);
      localStorage.setItem('wikiAnalyzerAdminMode', 'true');
    } else {
      // Use stored admin mode
      setIsAdminMode(storedAdminMode);
    }
    
    // Fetch IP only if not in admin mode
    if (!adminMode && !storedAdminMode) {
      getUserIp();
    } else {
      // In admin mode, no rate limits apply
      setRemainingSearches(Infinity);
    }
  }, []);

  // Inside your component, add this effect to load the current rate limit status on mount
  useEffect(() => {
    const remaining = getRemainingSearches();
    setRemainingSearches(remaining);
  }, []);

  // Update the handleSearch function to combine the keywords
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    try {
      // Store the current query as the searched query
      setSearchedQuery(query);
      
      // Check if search is allowed
      if (!isSearchAllowed()) {
        const timeUntilReset = getReadableTimeUntilReset();
        setErrorMessage(`You've reached the search limit. Please try again in ${timeUntilReset}.`);
        return;
      }
      
      // Build search query with modifiers
      let searchQuery = query.trim();
      if (modifierKeyword1.trim()) {
        searchQuery += ` ${modifierKeyword1.trim()}`;
      }
      if (modifierKeyword2.trim()) {
        searchQuery += ` ${modifierKeyword2.trim()}`;
      }
      
      console.log("Searching for:", searchQuery);
      
      // Increment the search count
      incrementSearchCount();
      
      // Update remaining searches
      setRemainingSearches(getRemainingSearches());
      
      // Continue with search
      await searchGoogle(searchQuery);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // Helper function to extract domain from URL
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'unknown';
    }
  };

  // Analyze organic sources
  const organicSourceAnalysis = (result: any) => {
    const domain = getDomain(result.url);
    return (
      <div className="text-sm text-gray-500 mt-1">
        <Globe className="inline-block h-3 w-3 mr-1" /> {domain}
      </div>
    );
  };

  // Analyze news sources
  const newsSourceAnalysis = (result: any) => {
    const domain = getDomain(result.url);
    let dateInfo = result.date ? new Date(result.date).toLocaleDateString() : '';
    
    return (
      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
        <span><Globe className="inline-block h-3 w-3 mr-1" /> {domain}</span>
        {dateInfo && <span>• {dateInfo}</span>}
      </div>
    );
  };

  // Render results list with source information and reliability indicators
  const renderResultsList = (results: any[], sourceAnalysisFn: (result: any) => React.ReactNode, type: string) => {
    if (results.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex justify-center mb-3">
            {type === 'organic' ? <Search className="h-10 w-10 text-gray-300" /> : <Newspaper className="h-10 w-10 text-gray-300" />}
          </div>
          <p>No {type} results found for "{query}"</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 mt-2">
        {results.map((result, index) => (
          <Card key={`${type}-${index}`} className="overflow-hidden newspaper-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline"
                >
                  {result.title}
                </a>
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <ExternalLink size={16} />
                </a>
                {renderReliabilityBadge(result.url)}
              </CardTitle>
              <CardDescription className="flex items-center text-sm">
                <Globe className="h-3.5 w-3.5 mr-1 text-gray-400" />
                <span className="text-gray-500 truncate">{result.url}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-gray-700">
                {result.description || "No description available."}
              </div>
              
              <div className="mt-2 flex flex-wrap gap-2">
                {result.tags?.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Render reliability badge based on source rating or citation count
  const renderReliabilityBadge = (url: string) => {
    const domain = getDomain(url);
    const normalizedDomain = getEffectiveDomain(domain);
    const citationCount = domainCitations[normalizedDomain];
    
    // Check if the domain is in our predefined list
    const isInPredefinedList = Object.keys(wikipediaSourceReliability).some(key => {
      return normalizedDomain === key || normalizedDomain.endsWith(`.${key}`);
    });
    
    // Get reliability using the citation count if available and not in predefined list
    const reliability = getSourceReliability(url);
    
    // Format the badge based on reliability
    switch (reliability.reliability) {
      case "Generally reliable":
        return (
          <Badge variant="success" className="text-xs ml-2 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Reliable
            {citationCount && citationCount > 0 && ` (${citationCount} citations)`}
          </Badge>
        );
      case "Generally unreliable":
        return (
          <Badge variant="destructive" className="text-xs ml-2 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Unreliable
          </Badge>
        );
      case "Deprecated":
        return (
          <Badge variant="destructive" className="text-xs ml-2 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Deprecated
          </Badge>
        );
      default:
        // For "No consensus" or other cases
        if (!isInPredefinedList) {
          if (citationCount && citationCount > 0) {
            // Show citation count directly if available
            return (
              <Badge variant="outline" className="text-xs ml-2 flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                No Consensus ({citationCount} citations)
              </Badge>
            );
          } else {
            // Add a check to prevent rendering CitationCount if we've already fetched it
            // and it returned 0
            const shouldShowCitationCount = !(normalizedDomain in domainCitations && domainCitations[normalizedDomain] === 0);
            
            return (
              <>
                <Badge variant="outline" className="text-xs ml-2 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  No Consensus
                </Badge>
                {shouldShowCitationCount && (
                  <span className="inline-block ml-1">
                    <CitationCount 
                      domain={normalizedDomain} 
                      onCitationCount={(count) => handleCitationCount(normalizedDomain, count)} 
                    />
                  </span>
                )}
              </>
            );
          }
        } else {
          return (
            <Badge variant="outline" className="text-xs ml-2 flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              No Consensus
            </Badge>
          );
        }
    }
  };

  // Update the loading animation
  useEffect(() => {
    if (isLoading) {
      // Reset loading state when search starts
      setLoadingStage(0);
      setLoadingProgress(0);
      
      // Create animation through the loading stages
      const intervals: NodeJS.Timeout[] = [];
      
      // For each loading stage
      loadingStages.forEach((stage, index) => {
        // Calculate delay for this stage
        const previousDuration = loadingStages
          .slice(0, index)
          .reduce((sum, s) => sum + s.duration, 0);
        
        // Start this stage after previous ones finish
        const stageInterval = setTimeout(() => {
          setLoadingStage(index);
          
          // Animate progress within this stage
          const progressInterval = setInterval(() => {
            setLoadingProgress(prev => {
              // Calculate target progress for this stage
              const stageProgress = (index + 1) / loadingStages.length * 100;
              const prevStageProgress = index / loadingStages.length * 100;
              const increment = (stageProgress - prevStageProgress) / 10;
              
              const newProgress = prev + increment;
              
              // Stop when we reach target for this stage
              if (newProgress >= stageProgress) {
                clearInterval(progressInterval);
                return stageProgress;
              }
              
              return newProgress;
            });
          }, stage.duration / 10);
          
          intervals.push(progressInterval);
        }, previousDuration);
        
        intervals.push(stageInterval);
      });
      
      // Cleanup function
      return () => intervals.forEach(interval => clearInterval(interval));
    }
  }, [isLoading]);

  return (
    <div className={`max-w-5xl w-full ${results.length > 0 ? 'h-screen' : ''} flex flex-col p-0`}>
      <Card className={`${results.length > 0 ? 'mb-4' : 'mb-0 w-full'} shadow-sm border-gray-200 p-0`}>
        <CardContent className={`${results.length > 0 ? 'pt-4 pb-3' : 'py-6'}`}>
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            {/* Make search input and button stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="search" 
                placeholder="Enter a name, company, or topic..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`flex-1 border-gray-300 ${results.length > 0 ? '' : 'text-lg py-6'}`}
              />
              <Button 
                type="submit" 
                disabled={isLoading || isRateLimited || !query.trim()} 
                className="ml-2 bg-[#17163e] hover:bg-[#232253] text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span className="ml-2">{isLoading ? "Analyzing..." : "Analyze"}</span>
              </Button>
            </div>
            
            {/* Make modifier keywords stack on mobile */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 ${results.length > 0 ? '' : 'mb-2'}`}>
              <div>
                <label htmlFor="modifier1" className="text-xs text-gray-500 mb-1 block">
                  Optional: Modifier keyword
                </label>
                <Input
                  id="modifier1"
                  type="text"
                  placeholder="e.g., CEO, Author, Technology"
                  value={modifierKeyword1}
                  onChange={(e) => setModifierKeyword1(e.target.value)}
                  className="border-gray-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="modifier2" className="text-xs text-gray-500 mb-1 block">
                  Optional: Additional modifier
                </label>
                <Input
                  id="modifier2"
                  type="text"
                  placeholder="e.g., New York, Software"
                  value={modifierKeyword2}
                  onChange={(e) => setModifierKeyword2(e.target.value)}
                  className="border-gray-300 text-sm"
                />
              </div>
            </div>
            
            {/* Add a hint about when to use modifiers */}
            <p className="text-xs text-gray-500 mt-1">
              Tip: If your search term is a common name or topic, add modifier keywords to make your search more specific. Check the sources tab in the results to verify accuracy.
            </p>
            
            {userIp && remainingSearches < Infinity && (
              <p className="text-xs text-gray-500 mt-1">
                You have {remainingSearches} searches remaining in this session.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Loading state with techy language but simple UI */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <div className="mb-6">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent border-primary mx-auto mb-4"></div>
            </div>
            
            <div className="text-primary font-medium mb-2">
              {loadingStages[loadingStage]?.message || "Processing..."}
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            
            <div className="text-xs text-gray-500">
              {Math.round(loadingProgress)}% complete
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <Alert variant="destructive" className="mt-2 mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Results display - tabbed interface optimized for mobile */}
      {results.length > 0 && !isLoading && (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="eligibility" className="h-full flex flex-col">
            <TabsList className="w-full mb-2 justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="eligibility" className="whitespace-nowrap">Eligibility</TabsTrigger>
              <TabsTrigger value="sources" className="whitespace-nowrap">Sources</TabsTrigger>
              <TabsTrigger value="draft" className="whitespace-nowrap">Wikipedia Draft</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto p-0">
              {/* Eligibility Tab */}
              <TabsContent value="eligibility" className="h-full overflow-auto m-0 p-0">
                <Card className="h-full border-gray-200 rounded-none">
                  <CardContent className="p-2">
                    <WikipediaEligibility result={eligibilityResult} query={searchedQuery} />
                    
                    {/* Add disclaimer at bottom of analysis */}
                    <div className="mt-6 text-xs text-gray-500 border-t pt-3 text-center">
                      <p>
                        <strong>Disclaimer:</strong> This analysis is an estimate and not a guarantee of Wikipedia eligibility (or lack thereof).
                        Wikipedia's standards and editor interpretations may vary.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Sources Tab */}
              <TabsContent value="sources" className="h-full overflow-auto m-0 p-0">
                {eligibilityResult && (
                  <SourcesTab 
                    categorizedSources={eligibilityResult.categorizedSources} 
                    sourcesList={eligibilityResult.sourcesList} 
                  />
                )}
              </TabsContent>
              
              {/* Wikipedia Draft Tab */}
              <TabsContent value="draft" className="h-full overflow-auto m-0 p-0">
                <Card className="h-full border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Wikipedia Draft</h3>
                      
                      <Button 
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.Calendly) {
                            window.Calendly.initPopupWidget({
                              url: 'https://calendly.com/orani/30min'
                            });
                          } else {
                            window.open('https://calendly.com/orani/30min', '_blank');
                          }
                        }}
                        className="bg-[#17163e] hover:bg-[#232253] text-white"
                        size="sm"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Book Consultation
                      </Button>
                    </div>
                    
                    <WikipediaArticleDraft 
                      query={searchedQuery}
                      sources={eligibilityResult?.sourcesList || []}
                      results={results}
                      newsResults={newsResults}
                      eligible={eligibilityResult?.eligible || false}
                      hasExistingWikipedia={eligibilityResult?.hasExistingWikipedia || false}
                      score={eligibilityResult?.score || 0}
                      existingWikipediaUrl={eligibilityResult?.existingWikipediaUrl}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
} 