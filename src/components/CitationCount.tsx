import React, { useState, useEffect } from 'react';
import { getWikipediaCitationCount } from '@/services/mediawikiService';
import { Loader2 } from 'lucide-react';

interface CitationCountProps {
  domain: string;
  onCitationCount: (count: number) => void;
}

export function CitationCount({ domain, onCitationCount }: CitationCountProps) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCitationCount = async () => {
      try {
        setLoading(true);
        
        // Correctly format the domain query
        const searchTerm = domain.replace(/^www\./, ''); // Remove www. if present
        
        // Use the more reliable search approach
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&format=json&origin=*`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.query && data.query.search) {
          // Count the number of search results that are likely citations
          let citationCount = 0;
          
          // For each result, check if it contains a reference to the domain
          const pageIds = data.query.search.map((result: any) => result.pageid);
          
          if (pageIds.length > 0) {
            // For each page found, check if it cites the domain
            const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&pageids=${pageIds.join('|')}&format=json&origin=*`;
            const contentResponse = await fetch(contentUrl);
            const contentData = await contentResponse.json();
            
            if (contentData.query && contentData.query.pages) {
              Object.values(contentData.query.pages).forEach((page: any) => {
                if (page.extlinks) {
                  page.extlinks.forEach((link: any) => {
                    if (link['*'] && link['*'].includes(searchTerm)) {
                      citationCount++;
                    }
                  });
                }
              });
            }
          }
          
          setCount(citationCount);
          onCitationCount(citationCount);
        } else {
          setCount(0);
          onCitationCount(0);
        }
      } catch (err) {
        console.error('Error fetching citation count:', err);
        setError('Failed to fetch citation count');
        setCount(0);
        onCitationCount(0);
      } finally {
        setLoading(false);
      }
    };

    if (domain) {
      fetchCitationCount();
    }
  }, [domain, onCitationCount]);
  
  if (loading) {
    return <span className="inline-flex items-center text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin mr-1" />Checking...</span>;
  }
  
  if (error) {
    return null;
  }
  
  if (count === 0) {
    return <span className="text-xs text-gray-500">No citations</span>;
  }
  
  return <span className="text-xs text-gray-500">{count} Wikipedia citations</span>;
} 