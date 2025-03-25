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
import { isSearchAllowed, getRemainingSearches, getTimeUntilReset } from '@/services/rateLimitService';

export function UnifiedSearch() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('organic');
  const [eligibilityResult, setEligibilityResult] = useState<WikipediaEligibilityResult | null>(null);
  
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
    if (results.length > 0 || newsResults.length > 0) {
      // Debug logging
      console.log(`Results found: ${results.length} organic, ${newsResults.length} news`);
      console.log("Checking for Wikipedia article in results:");
      
      const wikipediaResult = [...results, ...newsResults].find(r => 
        r.url.includes('wikipedia.org/wiki/') && 
        !r.url.includes('wikipedia.org/wiki/Category:')
      );
      
      if (wikipediaResult) {
        console.log("Wikipedia article found:", wikipediaResult.url);
      } else {
        console.log("No Wikipedia article found in results");
      }
      
      // Pass domainCitations to the assessment function
      const assessment = assessWikipediaEligibility(query, results, newsResults, domainCitations);
      console.log("Eligibility assessment:", assessment);
      setEligibilityResult(assessment);
    } else {
      setEligibilityResult(null);
    }
  }, [results, newsResults, query, domainCitations]);

  // Fix the useEffect that gets the user IP and checks admin mode
  useEffect(() => {
    const getUserIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setUserIp(data.ip);
        setRemainingSearches(getRemainingSearches(data.ip));
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

  // Then update the handleSearch function
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Skip rate limiting check in admin mode
    if (!isAdminMode && !isSearchAllowed(userIp)) {
      setIsRateLimited(true);
      
      // Calculate time until reset
      const resetTimeMs = getTimeUntilReset(userIp);
      const resetDays = Math.ceil(resetTimeMs / (24 * 60 * 60 * 1000));
      
      setErrorMessage(`Rate limit reached. You can perform 5 searches every 3 days. Please try again in ${resetDays} days.`);
      return;
    }
    
    setErrorMessage(null);
    setIsRateLimited(false);
    
    // Only update remaining searches if not in admin mode
    if (!isAdminMode) {
      setRemainingSearches(getRemainingSearches(userIp));
    }
    
    // Continue with the original search logic
    console.log("Searching for:", query);
    searchGoogle(query);
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

  // Add this effect to handle staged loading animation
  useEffect(() => {
    if (!isLoading) {
      // Reset progress when not loading
      setLoadingStage(0);
      setLoadingProgress(0);
      return;
    }

    let stageTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;
    let currentProgress = 0;
    
    // Advance to next stage
    const advanceStage = (stage: number) => {
      if (stage >= loadingStages.length) return;
      
      setLoadingStage(stage);
      currentProgress = 0;
      setLoadingProgress(0);
      
      // Set timer for next stage
      stageTimer = setTimeout(() => {
        advanceStage(stage + 1);
      }, loadingStages[stage].duration);
      
      // Update progress within this stage
      const progressInterval = 50; // Update every 50ms
      const incrementAmount = 100 / (loadingStages[stage].duration / progressInterval);
      
      progressTimer = setInterval(() => {
        currentProgress += incrementAmount;
        setLoadingProgress(Math.min(currentProgress, 100));
        
        if (currentProgress >= 100) clearInterval(progressTimer);
      }, progressInterval);
    };
    
    // Start the animation
    advanceStage(0);
    
    // Cleanup timers
    return () => {
      clearTimeout(stageTimer);
      clearInterval(progressTimer);
    };
  }, [isLoading, loadingStages]);

  return (
    <div className={`max-w-5xl w-full ${results.length > 0 ? 'h-screen' : ''} flex flex-col`}>
      <Card className={`${results.length > 0 ? 'mb-4' : 'mb-0 w-full'} shadow-sm border-gray-200`}>
        <CardContent className={`${results.length > 0 ? 'pt-4 pb-3' : 'py-10'}`}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="search" 
              placeholder="Enter a name, company, or topic..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`flex-1 border-gray-300 ${results.length > 0 ? '' : 'text-lg py-6'}`}
            />
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-[#17163e] hover:bg-[#232253] text-white font-medium"
              size={results.length > 0 ? "default" : "lg"}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white"></div>
                  <span className="sr-only">Analyzing...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Analyze
                </span>
              )}
            </Button>
          </form>
          {userIp && remainingSearches < Infinity && (
            <p className="text-xs text-gray-500 mt-1">
              You have {remainingSearches} searches remaining in this session.
            </p>
          )}
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

      {/* Results display - tabbed interface for better organization */}
      {results.length > 0 && !isLoading && (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="eligibility" className="h-full flex flex-col">
            <TabsList className="w-full mb-2 justify-start">
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
              <TabsTrigger value="draft">Wikipedia Draft</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto">
              {/* Eligibility Tab */}
              <TabsContent value="eligibility" className="h-full overflow-auto m-0 p-0">
                <Card className="h-full border-gray-200">
                  <CardContent className="p-4">
                    <WikipediaEligibility result={eligibilityResult} query={query} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Sources Tab */}
              <TabsContent value="sources" className="h-full overflow-auto m-0 p-0">
                <Card className="h-full border-gray-200">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium mb-2">Source Analysis</h3>
                        
                        {/* Add the consultation button */}
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
                      
                      {eligibilityResult && (
                        <div className="space-y-3">
                          {/* Source Statistics */}
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div className="border p-2 rounded">
                              <div className="text-xs text-gray-600">Reliable</div>
                              <div className="font-bold">
                                {eligibilityResult.sourcesList.filter(s => s.category === 'highlyReliable').length}
                              </div>
                            </div>
                            <div className="border p-2 rounded">
                              <div className="text-xs text-gray-600">Moderate</div>
                              <div className="font-bold">
                                {eligibilityResult.sourcesList.filter(s => s.category === 'moderatelyReliable').length}
                              </div>
                            </div>
                            <div className="border p-2 rounded">
                              <div className="text-xs text-gray-600">Unreliable</div>
                              <div className="font-bold">
                                {eligibilityResult.sourcesList.filter(s => s.category === 'unreliable').length}
                              </div>
                            </div>
                            <div className="border p-2 rounded">
                              <div className="text-xs text-gray-600">Deprecated</div>
                              <div className="font-bold">
                                {eligibilityResult.sourcesList.filter(s => s.category === 'deprecated').length}
                              </div>
                            </div>
                          </div>
                          
                          {/* Collapsible Source Lists - Exact copy from WikipediaEligibility */}
                          <Accordion type="multiple" className="w-full">
                            {eligibilityResult.sourcesList.filter(s => s.category === 'highlyReliable').length > 0 && (
                              <AccordionItem value="highlyReliable" className="border-b">
                                <AccordionTrigger className="text-sm py-2">
                                  <span className="flex items-center">
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'highlyReliable').length} Highly Reliable Sources
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-sm space-y-1">
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'highlyReliable').map((source, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-1">•</span>
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {source.domain}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            
                            {/* Similar structure for other categories */}
                            {/* Moderately Reliable */}
                            {eligibilityResult.sourcesList.filter(s => s.category === 'moderatelyReliable').length > 0 && (
                              <AccordionItem value="moderatelyReliable" className="border-b">
                                <AccordionTrigger className="text-sm py-2">
                                  <span className="flex items-center">
                                    <HelpCircle className="h-4 w-4 mr-2 text-blue-500" />
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'moderatelyReliable').length} Moderately Reliable Sources
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-sm space-y-1">
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'moderatelyReliable').map((source, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-1">•</span>
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {source.domain}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            
                            {/* Unreliable */}
                            {eligibilityResult.sourcesList.filter(s => s.category === 'unreliable').length > 0 && (
                              <AccordionItem value="unreliable" className="border-b">
                                <AccordionTrigger className="text-sm py-2">
                                  <span className="flex items-center">
                                    <XCircle className="h-4 w-4 mr-2 text-gray-500" />
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'unreliable').length} Unreliable Sources
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-sm space-y-1">
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'unreliable').map((source, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-1">•</span>
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {source.domain}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            
                            {/* Deprecated */}
                            {eligibilityResult.sourcesList.filter(s => s.category === 'deprecated').length > 0 && (
                              <AccordionItem value="deprecated" className="border-b">
                                <AccordionTrigger className="text-sm py-2">
                                  <span className="flex items-center">
                                    <XCircle className="h-4 w-4 mr-2 text-gray-500" />
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'deprecated').length} Deprecated Sources
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-sm space-y-1">
                                    {eligibilityResult.sourcesList.filter(s => s.category === 'deprecated').map((source, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-1">•</span>
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {source.domain}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            
                            {/* No Consensus/Unknown */}
                            {eligibilityResult.sourcesList.filter(s => !['highlyReliable', 'moderatelyReliable', 'unreliable', 'deprecated'].includes(s.category)).length > 0 && (
                              <AccordionItem value="noConsensus" className="border-b">
                                <AccordionTrigger className="text-sm py-2">
                                  <span className="flex items-center">
                                    <HelpCircle className="h-4 w-4 mr-2 text-gray-500" />
                                    {eligibilityResult.sourcesList.filter(s => !['highlyReliable', 'moderatelyReliable', 'unreliable', 'deprecated'].includes(s.category)).length} Sources Without Consensus/Unknown
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-sm space-y-1">
                                    {eligibilityResult.sourcesList.filter(s => !['highlyReliable', 'moderatelyReliable', 'unreliable', 'deprecated'].includes(s.category)).map((source, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-1">•</span>
                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {source.domain}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                      query={query}
                      sources={[...results, ...newsResults].map(result => ({
                        ...result,
                        domain: result.url ? new URL(result.url).hostname : '',
                        reliability: 'unknown',
                        category: 'moderatelyReliable',
                        relevance: 'high'
                      }))}
                      results={results}
                      newsResults={newsResults}
                      eligible={eligibilityResult?.eligible || false}
                      hasExistingWikipedia={eligibilityResult?.hasExistingWikipedia || false}
                      score={eligibilityResult?.score || 0}
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