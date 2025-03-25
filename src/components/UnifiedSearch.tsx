import React, { useState, useEffect, useCallback } from 'react';
import { useDataForSeoSearch } from '@/services/dataForSeoService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, AlertCircle, Globe, Info, Search, Newspaper, BookOpen, CheckCircle, XCircle, HelpCircle, Shield } from 'lucide-react';
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
  
  // Update the handleCitationCount callback
  const handleCitationCount = useCallback((domain: string, count: number) => {
    setDomainCitations(prev => ({
      ...prev,
      [domain]: count
    }));
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

  // Add effect to get user IP
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
    
    // Add this to your useEffect that runs on component mount
    useEffect(() => {
      // Check for admin mode from query parameter or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const adminMode = urlParams.get('admin') === 'true';
      
      if (adminMode) {
        // Set admin mode and store in localStorage
        setIsAdminMode(true);
        localStorage.setItem('wikiAnalyzerAdminMode', 'true');
      } else {
        // Check if admin mode is stored in localStorage
        const storedAdminMode = localStorage.getItem('wikiAnalyzerAdminMode') === 'true';
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
  };

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
    const reliability = getSourceReliability(url, !isInPredefinedList ? citationCount : undefined);
    
    // Format the badge based on reliability
    switch (reliability.reliability) {
      case "Generally reliable":
        return (
          <Badge variant="success" className="text-xs ml-2 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Reliable
            {reliability.citationCount && ` (${reliability.citationCount} citations)`}
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
            // If no citations yet, show citation counter component
            return (
              <>
                <Badge variant="outline" className="text-xs ml-2 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  No Consensus
                </Badge>
                <span className="inline-block ml-1">
                  <CitationCount 
                    domain={normalizedDomain} 
                    onCitationCount={(count) => handleCitationCount(normalizedDomain, count)} 
                  />
                </span>
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

  return (
    <div className="max-w-5xl mx-auto">
      <Card className="mb-8 border-accent/20 newspaper-card">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input 
              type="search" 
              placeholder="Enter a name, company, or topic..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-accent/30 focus-visible:ring-secondary"
            />
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white"></div>
                  Analyzing...
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
            <p className="text-xs text-muted-foreground mt-2">
              You have {remainingSearches} searches remaining in this period.
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent border-primary mb-4"></div>
          <p className="text-muted-foreground">Analyzing digital footprint...</p>
        </div>
      )}

      {errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Results Summary */}
      {eligibilityResult && (
        <div className="space-y-6">
          <Card className="mt-8 mb-6 border-secondary/20 overflow-hidden newspaper-card">
            <div className="bg-primary/5 border-b border-primary/10 py-3 px-6">
              <h3 className="font-medium flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-secondary" />
                Wikipedia Assessment
              </h3>
            </div>
            <CardContent className="pt-6">
              <Tabs defaultValue="assessment" className="mt-2">
                <TabsList className="w-full mb-4 p-1 bg-muted/80 shadow-sm">
                  <TabsTrigger 
                    value="assessment" 
                    className="flex-1 py-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm hover:bg-gray-50 data-[state=inactive]:hover:bg-gray-100/50 transition-all"
                  >
                    Eligibility Analysis
                  </TabsTrigger>
                  <TabsTrigger 
                    value="draft" 
                    className="flex-1 py-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm hover:bg-gray-50 data-[state=inactive]:hover:bg-gray-100/50 transition-all"
                  >
                    Draft Article
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="assessment">
                  {!(eligibilityResult.hasExistingWikipedia && eligibilityResult.existingWikipediaUrl) && (
                    <WikipediaEligibility result={eligibilityResult} />
                  )}
                  {(eligibilityResult.hasExistingWikipedia && eligibilityResult.existingWikipediaUrl) && (
                    <Alert variant="default" className="bg-green-50 border-green-200 mt-4">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="font-medium text-green-800">
                            This topic already has a Wikipedia article
                          </p>
                          <a 
                            href={eligibilityResult.existingWikipediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-700 underline text-sm"
                          >
                            View Wikipedia article
                          </a>
                        </div>
                      </div>
                    </Alert>
                  )}
                </TabsContent>
                
                <TabsContent value="draft">
                  <WikipediaArticleDraft 
                    query={query}
                    sources={eligibilityResult.sourcesList || []}
                    results={results}
                    newsResults={newsResults}
                    eligible={eligibilityResult.eligible}
                    hasExistingWikipedia={eligibilityResult.hasExistingWikipedia}
                    score={eligibilityResult.score}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {rawData && !results.length && !newsResults.length && (
        <Card className="max-w-3xl mx-auto mt-6">
          <CardHeader>
            <CardTitle className="text-amber-600">Debug Information</CardTitle>
            <CardDescription>
              API returned data but no results were processed. Inspect the raw response below:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs max-h-96">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 