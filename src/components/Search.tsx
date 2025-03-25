import React, { useState, useMemo } from 'react';
import { useDataForSeoSearch } from '@/services/dataForSeoService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Search as SearchIcon, AlertCircle, Globe, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Search() {
  const [query, setQuery] = useState('');
  const { results, isLoading, error, searchGoogle, rawData } = useDataForSeoSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", query);
    searchGoogle(query);
  };

  // Extract and analyze sources from results
  const sourceAnalysis = useMemo(() => {
    if (!results.length) return null;

    // Extract domains from URLs
    const domains = results.map(result => {
      try {
        const url = new URL(result.url);
        return url.hostname;
      } catch (e) {
        return 'unknown-domain';
      }
    });

    // Count occurrences of each domain
    const domainCounts = domains.reduce((acc, domain) => {
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort domains by frequency
    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }));

    return {
      totalSources: sortedDomains.length,
      domains: sortedDomains
    };
  }, [results]);

  // Extract domain from URL for display
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'unknown-domain';
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold">DataForSEO Search</h1>
      
      <form onSubmit={handleSearch} className="flex w-full max-w-xl mx-auto gap-2">
        <Input
          type="text"
          placeholder="Enter search query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {isLoading && (
        <Alert className="max-w-2xl mx-auto">
          <Info className="h-4 w-4" />
          <AlertTitle>Searching...</AlertTitle>
          <AlertDescription>Please wait while we fetch results from DataForSEO.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{error}</p>
              <p className="text-xs">Please check your API credentials and network connection.</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {sourceAnalysis && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Source Analysis</CardTitle>
            <CardDescription>
              Found {results.length} results from {sourceAnalysis.totalSources} unique sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sourceAnalysis.domains.map(({ domain, count }) => (
                <Badge key={domain} variant="secondary" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {domain} <span className="ml-1 bg-primary/20 px-1 rounded-sm">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold">Search Results ({results.length})</h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            {results.map((result) => (
              <AccordionItem key={result.url} value={result.url}>
                <Card>
                  <CardHeader className="p-0">
                    <div className="flex items-start gap-2 p-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <span className="text-xs font-medium">{result.position}</span>
                      </div>
                      <div className="flex-1">
                        <AccordionTrigger className="py-0 hover:no-underline">
                          <CardTitle className="text-base font-medium text-left">
                            {result.title}
                          </CardTitle>
                        </AccordionTrigger>
                        <div className="flex items-center justify-between mt-1">
                          <CardDescription className="text-sm truncate max-w-[70%]">
                            <a 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-700 hover:underline flex items-center gap-1"
                            >
                              {result.url} <ExternalLink className="h-3 w-3" />
                            </a>
                          </CardDescription>
                          <Badge variant="secondary" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" /> {getDomain(result.url)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="py-3">
                      <p className="text-sm text-gray-700">{result.description}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Type: {result.type}</p>
                        {result.rank && <p>Rank: {result.rank}</p>}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-3">
                      <div className="text-xs text-gray-500 flex items-center">
                        <Globe className="h-3 w-3 mr-1" /> Source: {getDomain(result.url)}
                      </div>
                    </CardFooter>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {rawData && !results.length && (
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