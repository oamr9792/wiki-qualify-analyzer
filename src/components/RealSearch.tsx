import React, { useState } from 'react';
import { useDataForSeoSearch } from '@/services/dataForSeoService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, AlertCircle } from 'lucide-react';

export function RealSearch() {
  const [query, setQuery] = useState('');
  const { results, isLoading, error, searchGoogle, rawData } = useDataForSeoSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("DIRECT SEARCH for:", query);
    searchGoogle(query);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Direct DataForSEO Search</CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          <form onSubmit={handleSearch} className="flex w-full gap-2">
            <Input
              type="text"
              placeholder="Search anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search Now'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Results ({results.length})</h3>
              <div className="space-y-4">
                {results.map((result) => (
                  <Card key={result.url} className="p-4">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <span className="text-xs font-medium">{result.position}</span>
                      </div>
                      <div>
                        <h4 className="font-medium">{result.title}</h4>
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-700 hover:underline text-sm flex items-center gap-1"
                        >
                          {result.url} <ExternalLink className="h-3 w-3" />
                        </a>
                        <p className="text-sm mt-1">{result.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {rawData && !results.length && (
            <div className="mt-6">
              <h3 className="font-semibold text-amber-600">API Response</h3>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs max-h-96 mt-2">
                {JSON.stringify(rawData, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 