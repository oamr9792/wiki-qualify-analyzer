import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Copy, FileText, CheckCircle, AlertTriangle, AlertCircle, InfoIcon, Calendar } from 'lucide-react';
import { AnalyzedSource } from '@/utils/wikipediaEligibility';
import { SearchResult } from '@/services/dataForSeoService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateWikipediaDraftWithOpenAI } from '@/services/openaiService';

interface WikipediaArticleDraftProps {
  query: string;
  sources: AnalyzedSource[];
  results: SearchResult[];
  newsResults: SearchResult[];
  eligible: boolean;
  hasExistingWikipedia: boolean;
  score: number;
  existingWikipediaUrl?: string;
}

export function WikipediaArticleDraft({ 
  query, 
  sources, 
  results, 
  newsResults, 
  eligible,
  hasExistingWikipedia,
  score,
  existingWikipediaUrl
}: WikipediaArticleDraftProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [articleDraft, setArticleDraft] = useState<string>('');
  const [activeTab, setActiveTab] = useState('preview');
  const [copied, setCopied] = useState(false);
  
  // Check if potentially eligible (score > 40 and has at least 3 reliable sources)
  const isPotentiallyEligible = !eligible && score > 40 && 
    sources.filter(s => s.category === 'highlyReliable' || s.category === 'moderatelyReliable').length >= 3;
  
  // Need notability disclaimer (score < 70)
  const needsNotabilityDisclaimer = score < 70;

  // Generate a Wikipedia-style article draft using OpenAI
  useEffect(() => {
    if (hasExistingWikipedia) return;
    if (!eligible && score < 65) return;
    
    generateArticleDraft();
  }, [query, sources, results, newsResults, eligible, hasExistingWikipedia, score]);

  // Simplified article generation using only OpenAI
  const generateArticleDraft = async () => {
    setIsGenerating(true);
    
    try {
      // Filter for reliable sources
      const reliableSources = sources.filter(source => 
        source.category === 'highlyReliable' || source.category === 'moderatelyReliable'
      );
      
      if (reliableSources.length < 3) {
        setArticleDraft("Insufficient reliable sources to draft a Wikipedia article. A minimum of 3 reliable sources is recommended.");
        setIsGenerating(false);
        return;
      }
      
      // Direct call to OpenAI with the user's prompt
      const openAIDraft = await generateWikipediaDraftWithOpenAI(query, reliableSources);
      
      setArticleDraft(openAIDraft);
    } catch (error) {
      console.error('Error generating article draft:', error);
      setArticleDraft("An error occurred while generating the draft. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Helper function to synthesize a lead section from descriptions
  const synthesizeLeadSection = (title: string, descriptions: string[]): string => {
    // Join unique parts of descriptions, avoiding repetition
    const uniquePhrases = new Set<string>();
    descriptions.forEach(desc => {
      // Split into sentences and add unique ones
      desc.split(/[.!?]+/).forEach(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length > 15) { // Only add substantial sentences
          uniquePhrases.add(trimmed);
        }
      });
    });
    
    // Create a concise lead paragraph
    const phrases = Array.from(uniquePhrases).slice(0, 3);
    
    // Ensure third person perspective and basic grammar fixes
    const cleanedPhrases = phrases.map(phrase => {
      // Replace first-person pronouns with appropriate third-person alternatives
      let cleaned = phrase
        .replace(/\bI\b/g, "they")
        .replace(/\bmy\b/g, "their")
        .replace(/\bwe\b/g, "they")
        .replace(/\bour\b/g, "their")
        .replace(/\byou\b/g, "one")
        .replace(/\byour\b/g, "their");
      
      // Ensure sentence starts with capital letter and ends with period if it doesn't already
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!['.', '!', '?'].includes(cleaned.charAt(cleaned.length - 1))) {
        cleaned += '.';
      }
      
      return cleaned;
    });
    
    // Construct the lead paragraph, ensuring it starts with the article subject
    if (cleanedPhrases.length > 0) {
      // Check if first phrase already starts with the title
      if (!cleanedPhrases[0].startsWith(title)) {
        return `${title} is ${cleanedPhrases.join(' ')}`;
      } else {
        return cleanedPhrases.join(' ');
      }
    } else {
      return `${title} is a notable subject that has received coverage in reliable sources.`;
    }
  };
  
  // Generate article sections based on the type of subject
  const generateContentSections = (title: string, results: SearchResult[], sources: AnalyzedSource[]): string => {
    // Determine if this is likely a person, organization, or other topic
    const isPerson = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(title);
    const isOrganization = /(Inc\.|LLC|Corp|Company|Organization|Group)\b/.test(title);
    
    if (isPerson) {
      return `## Biography
      
${title} is a notable individual who has received significant coverage in reliable sources. Their biographical information includes details about their early life, career, and accomplishments.

## Career

${title}'s career has been documented in multiple reliable publications. They have established a professional presence that has garnered attention from reputable sources.

## Notable work

${title} has produced work that has been recognized in reliable sources. Their contributions to their field include achievements that have been documented by independent publications.

`;
    } else if (isOrganization) {
      return `## History
      
${title} is an organization that has been covered by multiple reliable sources. It was founded and has developed in ways that have been documented by independent publications.

## Operations

${title} engages in activities that have been reported in reliable sources. Its products, services, or operations have received coverage from independent publications.

## Recognition

${title} has received recognition that has been documented in reliable sources. Its achievements or impact has been acknowledged by independent publications.

`;
    } else {
      return `## Overview
      
${title} is a topic that has received coverage in multiple reliable sources. It represents a subject that has been documented with sufficient detail to establish its notability.

## History

The historical development of ${title} has been covered by reliable sources. Its origin and evolution have been documented in independent publications.

## Significance

${title} has significance that has been acknowledged in reliable sources. Its impact or importance in its relevant field has been documented by independent publications.

`;
    }
  };
  
  // New helper function to create a lead section from extracted content
  const createLeadFromExtractedContent = (title: string, contents: Array<{text?: string; title?: string}>) => {
    // Extract first paragraphs from each source
    const firstParagraphs = contents
      .map(content => {
        if (!content.text) return '';
        
        // Get first substantial paragraph
        const paragraphs = content.text.split(/\n+/);
        return paragraphs.find(p => p.length > 50) || paragraphs[0] || '';
      })
      .filter(p => p.length > 0);
    
    if (firstParagraphs.length === 0) {
      return `${title} is a subject with notable coverage in reliable sources.`;
    }
    
    // Use natural language processing techniques to create a cohesive paragraph
    // For simplicity, we'll just use the most substantial paragraph and ensure it starts with the title
    const bestParagraph = firstParagraphs.sort((a, b) => b.length - a.length)[0];
    
    // Ensure third-person perspective and proper grammar
    let cleanedParagraph = bestParagraph
      .replace(/\bI\b/g, "they")
      .replace(/\bmy\b/g, "their")
      .replace(/\bwe\b/g, "they")
      .replace(/\bour\b/g, "their")
      .replace(/\byou\b/g, "one")
      .replace(/\byour\b/g, "their");
    
    // Make sure it starts with the subject
    if (!cleanedParagraph.toLowerCase().includes(title.toLowerCase())) {
      return `${title} is ${cleanedParagraph}`;
    }
    
    return cleanedParagraph;
  };

  // New helper function to generate content sections from extracted content
  const generateContentSectionsFromExtracted = (title: string, contents: Array<{text?: string; title?: string; url: string}>) => {
    const sections = [];
    
    // Determine if this is likely a person, organization, or other topic
    const isPerson = /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(title);
    const isOrganization = /\b(Inc|Corp|Company|Organization|Ltd|LLC|Association|University|College|School)\b/i.test(title);
    
    // Basic sections based on the type of topic
    if (isPerson) {
      sections.push("## Early life and education\n\n");
      
      // Extract relevant content about early life if available
      const earlyLifeContent = extractRelevantContent(contents, ['early life', 'education', 'childhood', 'background', 'born']);
      sections.push(`${earlyLifeContent || 'Information about early life and education will be added here.'}\n\n`);
      
      sections.push("## Career\n\n");
      
      // Extract career-related content
      const careerContent = extractRelevantContent(contents, ['career', 'work', 'professional', 'job', 'employment', 'position']);
      sections.push(`${careerContent || 'Information about career will be added here.'}\n\n`);
      
    } else if (isOrganization) {
      sections.push("## History\n\n");
      
      // Extract history content
      const historyContent = extractRelevantContent(contents, ['history', 'founded', 'established', 'beginning', 'started']);
      sections.push(`${historyContent || 'Information about the history will be added here.'}\n\n`);
      
      sections.push("## Products and services\n\n");
      
      // Extract products/services content
      const productsContent = extractRelevantContent(contents, ['product', 'service', 'offering', 'provides', 'sells']);
      sections.push(`${productsContent || 'Information about products and services will be added here.'}\n\n`);
      
    } else {
      // Generic topic
      sections.push("## Background\n\n");
      
      // Extract background content
      const backgroundContent = extractRelevantContent(contents, ['background', 'overview', 'about', 'introduction']);
      sections.push(`${backgroundContent || 'Background information will be added here.'}\n\n`);
      
      sections.push("## Significance\n\n");
      
      // Extract significance content
      const significanceContent = extractRelevantContent(contents, ['significance', 'importance', 'impact', 'effect', 'influence']);
      sections.push(`${significanceContent || 'Information about significance will be added here.'}\n\n`);
    }
    
    return sections.join('');
  };

  // Helper to extract relevant content based on keywords
  const extractRelevantContent = (
    contents: Array<{text?: string; title?: string; url: string}>, 
    keywords: string[]
  ): string => {
    // Concatenate all content
    const allText = contents
      .map(c => c.text || '')
      .join('\n\n');
    
    // Split into paragraphs
    const paragraphs = allText.split(/\n+/);
    
    // Find paragraphs containing the keywords
    const relevantParagraphs = paragraphs.filter(p => 
      keywords.some(keyword => p.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    if (relevantParagraphs.length === 0) {
      return '';
    }
    
    // Return the most substantial paragraphs (up to 3)
    return relevantParagraphs
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .join('\n\n');
  };

  // Update the citation formatter to include extracted content info
  const formatCitation = (
    source: AnalyzedSource, 
    results: SearchResult[], 
    extractedContent: Array<{url: string; title?: string; date?: string; author?: string}>
  ): string => {
    // Try to find the extracted content for this source
    const extractedInfo = extractedContent.find(c => c.url === source.url);
    
    // If we have extracted content, use that information
    if (extractedInfo) {
      const author = extractedInfo.author ? `${extractedInfo.author}. ` : '';
      const title = extractedInfo.title || source.domain;
      const date = extractedInfo.date || new Date().toLocaleDateString();
      
      return `${author}"${title}". ${source.domain}. ${date}. ${source.url}`;
    }
    
    // Otherwise, use the search result information
    const matchingResult = results.find(r => r.url === source.url);
    
    if (matchingResult) {
      return `"${matchingResult.title}". ${source.domain}. ${matchingResult.date || 'Retrieved ' + new Date().toLocaleDateString()}. ${source.url}`;
    } else {
      return `${source.domain}. URL: ${source.url}`;
    }
  };
  
  // Guess at appropriate categories
  const getCategoryType = (query: string): string => {
    const words = query.toLowerCase().split(' ');
    
    if (words.some(w => ['university', 'college', 'school'].includes(w))) {
      return 'Educational institutions';
    } else if (words.some(w => ['company', 'corporation', 'inc'].includes(w))) {
      return 'Companies';
    } else if (words.some(w => ['actor', 'actress', 'singer', 'musician', 'artist'].includes(w))) {
      return 'Entertainers';
    } else if (words.length === 2 && words.every(w => w.length > 1 && /^[A-Za-z]+$/.test(w))) {
      return 'People';
    } else {
      return 'Miscellaneous';
    }
  };
  
  // Handle copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(articleDraft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // If not eligible or potentially eligible, and no existing Wikipedia, show message
  if (!eligible && !isPotentiallyEligible) {
    return (
      <div className="bg-muted p-8 rounded-lg text-center">
        <p className="text-muted-foreground">
          This topic does not appear to be eligible for a Wikipedia article based on the sources found.
          Wikipedia requires multiple reliable, independent sources for article creation.
        </p>
      </div>
    );
  }
  
  if (hasExistingWikipedia) {
    return (
      <div className="bg-muted p-8 rounded-lg text-center">
        <p className="text-muted-foreground">
          This topic already has a Wikipedia article. You can contribute to the existing article rather than creating a new draft.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* For existing Wikipedia articles */}
      {hasExistingWikipedia && (
        <Alert variant="warning" className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            This topic already has a Wikipedia article. A draft is not needed.
            {existingWikipediaUrl && (
              <a 
                href={existingWikipediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline ml-1"
              >
                View article
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {/* For topics with low score */}
      {!hasExistingWikipedia && score < 65 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>This topic is not yet eligible for a Wikipedia page.</strong> It scored below the threshold of 65 points 
            (current score: {Math.round(score)}). To improve eligibility, find additional high-quality independent sources 
            about this topic that demonstrate its notability.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Only show draft content for eligible topics */}
      {!hasExistingWikipedia && score >= 65 && (
        <>
          {needsNotabilityDisclaimer && (
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Notability Warning:</strong> This draft may face scrutiny from Wikipedia editors. Consider 
                finding additional high-quality, independent sources before submission.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium newspaper-heading">Wikipedia Article Draft</h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                className={copied ? "text-success" : ""}
              >
                {copied ? (
                  <><CheckCircle className="h-4 w-4 mr-2" />Copied</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copy</>
                )}
              </Button>
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
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
              <TabsTrigger value="markdown" className="flex-1">Markdown</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preview" className="p-0">
              <Card className="border border-gray-200 newspaper-card">
                <CardContent className="p-6">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-primary mb-4"></div>
                      <p className="text-muted-foreground">Generating article draft...</p>
                    </div>
                  ) : (
                    <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                      {articleDraft}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="markdown">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <pre className="whitespace-pre-wrap break-words text-sm p-4 bg-muted rounded-md">
                    {articleDraft}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mb-6">
            {hasExistingWikipedia ? (
              <Alert variant="warning" className="mb-4">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  This topic already has a Wikipedia article. A draft is not needed.
                  {existingWikipediaUrl && (
                    <a 
                      href={existingWikipediaUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-1"
                    >
                      View article
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            ) : eligible ? (
              <>
                <h2 className="text-lg font-medium mb-2">You Could be Eligible for a Wikipedia Page</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Your topic appears to meet the credibility and sourcing requirements Wikipedia editors look for. 
                  That's a strong position to be in—congrats.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Contact us for a consultation</strong> to go over next steps. We'll help you fine-tune your narrative, 
                  identify the best sources to cite, and ensure you approach the process the right way—from draft to approval.
                </p>
                <Button 
                  onClick={() => window.open('mailto:info@wikipublisher.com')}
                  className="mb-6 bg-blue-900 hover:bg-blue-800 text-white font-medium"
                >
                  Contact us for a consultation
                </Button>
              </>
            ) : score >= 65 ? (
              <>
                <h2 className="text-lg font-medium mb-2">You Could be Eligible for a Wikipedia Page</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Your topic appears to meet the credibility and sourcing requirements Wikipedia editors look for. 
                  That's a strong position to be in—congrats.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Contact us for a consultation</strong> to go over next steps. We'll help you fine-tune your narrative, 
                  identify the best sources to cite, and ensure you approach the process the right way—from draft to approval.
                </p>
                <Button 
                  onClick={() => window.open('mailto:info@wikipublisher.com')}
                  className="mb-6 bg-blue-900 hover:bg-blue-800 text-white font-medium"
                >
                  Contact us for a consultation
                </Button>
              </>
            ) : score >= 45 ? (
              <>
                <h2 className="text-lg font-medium mb-2">You're Close — But Not Quite There</h2>
                <p className="text-sm text-gray-600 mb-2">
                  You're on the right track. Your subject shows some signs of notability, but it needs a stronger 
                  foundation to meet Wikipedia's standards. A few more high-quality media mentions or third-party 
                  sources could make all the difference.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Contact us for a consultation</strong> and we'll show you how to build up your credibility, 
                  fill in the missing gaps, and get closer to Wikipedia eligibility without wasting time or money.
                </p>
                <Button 
                  onClick={() => window.open('mailto:info@wikipublisher.com')}
                  className="mb-6 bg-blue-900 hover:bg-blue-800 text-white font-medium"
                >
                  Contact us for a consultation
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium mb-2">You're Not Ready (Yet)</h2>
                <p className="text-sm text-gray-600 mb-2">
                  Wikipedia only allows pages about topics that meet its strict standards for notability and credibility. 
                  Right now, the available sources and public footprint around your name or brand aren't quite strong enough.
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  But here's the good news: you can build that credibility. With the right strategy—media coverage, 
                  high-authority citations, and a strong digital footprint—you can get there.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Contact us for a consultation</strong> to discuss how we can boost your online presence, credibility, 
                  and reputation—so you're ready for Wikipedia when it counts.
                </p>
                <Button 
                  onClick={() => window.open('mailto:info@wikipublisher.com')}
                  className="mb-6 bg-blue-900 hover:bg-blue-800 text-white font-medium"
                >
                  Contact us for a consultation
                </Button>
              </>
            )}
          </div>
        </>
      )}
      
      {/* For low-score topics that don't show a draft, show Calendly too */}
      {!hasExistingWikipedia && score < 65 && (
        <div className="mt-6">
          <Button onClick={() => window.open('mailto:info@wikipublisher.com')}>Contact Us</Button>
        </div>
      )}
    </div>
  );
} 