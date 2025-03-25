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
  const [hasRun, setHasRun] = useState(false);
  
  useEffect(() => {
    if (!domain || hasRun) return;
    
    const fetchCitationCount = async () => {
      try {
        setLoading(true);
        const citationCount = await getWikipediaCitationCount(domain);
        setCount(citationCount);
        
        if (!hasRun) {
          onCitationCount(citationCount);
          setHasRun(true);
        }
      } catch (err) {
        console.error('Error fetching citation count:', err);
        setError('Failed to fetch citation count');
        setCount(0);
        
        if (!hasRun) {
          onCitationCount(0);
          setHasRun(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCitationCount();
  }, [domain]);
  
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