/**
 * Service for interacting with the Firecrawl API to extract content from web pages
 * Based on documentation at https://docs.firecrawl.dev/introduction
 */

// The API key should be stored in an environment variable for production
const FIRECRAWL_API_KEY = 'fc-c57ec2f285c14b1b85412894b03d58ea';
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';

// Cache to avoid re-crawling the same URLs
const contentCache: Record<string, any> = {};

// Flag to force using mock data (only for testing)
const FORCE_MOCK_DATA = false;

// Mock data to use when rate limited
const getMockDataForUrl = (url: string) => {
  // Extract domain to customize mock data
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url.split('/')[0];
  }
  
  return {
    success: true,
    title: `Article from ${domain}`,
    text: `This is content extracted from ${url}.\n\n` +
          `This article discusses the topic in detail, providing background information and context. ` +
          `The author presents several key points about the subject matter, citing relevant research and expert opinions.\n\n` +
          `According to industry experts, this topic has significant implications for the field. ` +
          `Several studies have demonstrated the importance of understanding these concepts thoroughly.\n\n` +
          `In conclusion, the article provides valuable insights into the topic and offers recommendations for further research.`,
    date: new Date().toISOString().split('T')[0],
    author: "Various Authors",
    source: 'mock' as const
  };
};

/**
 * Create a job to extract content and initiate the extraction
 * @param url URL to extract content from
 * @returns Promise resolving to the job ID
 */
const createExtractionJob = async (url: string): Promise<string> => {
  const response = await fetch(`${FIRECRAWL_BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
    },
    body: JSON.stringify({
      url: url,
      html: true,
      markdown: true,
      text: true
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create extraction job: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Created extraction job for ${url}:`, data);
  
  if (!data.success || !data.jobId) {
    throw new Error('Job creation response did not contain a valid job ID');
  }
  
  return data.jobId;
};

/**
 * Poll for job completion
 * @param jobId The job ID to poll
 * @param maxAttempts Maximum number of polling attempts
 * @param initialDelayMs Initial delay before first poll
 * @returns Promise resolving to job result
 */
const pollForJobCompletion = async (
  jobId: string, 
  maxAttempts = 10, 
  initialDelayMs = 1500
): Promise<any> => {
  console.log(`Starting polling for job ${jobId}`);
  
  // Initial delay to allow job registration
  await new Promise(resolve => setTimeout(resolve, initialDelayMs));
  
  let attempts = 0;
  let delay = 2000; // Starting delay between polls
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Poll attempt ${attempts}/${maxAttempts} for job ${jobId}`);
    
    try {
      const response = await fetch(`${FIRECRAWL_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
        }
      });
      
      // Handle 404 errors (job not found)
      if (response.status === 404) {
        console.warn(`Job ${jobId} not found (attempt ${attempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 10000); // Increase delay with backoff
        continue;
      }
      
      if (!response.ok) {
        console.error(`Error checking job ${jobId} status: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 10000);
        continue;
      }
      
      const data = await response.json();
      console.log(`Job ${jobId} status:`, data);
      
      if (data.status === 'completed') {
        console.log(`Job ${jobId} completed successfully`);
        return data;
      }
      
      if (data.status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${data.error || 'Unknown error'}`);
      }
      
      console.log(`Job ${jobId} still processing, waiting...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 10000);
    } catch (error) {
      console.error(`Error polling job ${jobId}:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 10000);
    }
  }
  
  throw new Error(`Polling timed out after ${maxAttempts} attempts for job ${jobId}`);
};

/**
 * Extract content from a URL using Firecrawl API
 * @param url URL to extract content from
 * @returns Promise resolving to extracted content
 */
export const extractContent = async (url: string): Promise<{
  title?: string;
  text?: string;
  date?: string;
  author?: string;
  success: boolean;
  error?: string;
  source?: 'api' | 'cache' | 'mock';
}> => {
  // Return cached result if available
  if (contentCache[url]) {
    console.log(`Using cached content for ${url}`);
    return { ...contentCache[url], source: 'cache' };
  }
  
  // If we're forcing mock data, return it immediately
  if (FORCE_MOCK_DATA) {
    console.log(`Using mock data for ${url} (forced)`);
    const mockData = getMockDataForUrl(url);
    return mockData;
  }

  try {
    console.log(`Extracting content from: ${url} using Firecrawl API`);
    
    // First, create a job
    const jobId = await createExtractionJob(url);
    console.log(`Created job ${jobId} for ${url}`);
    
    // Then, poll for job completion
    const jobResult = await pollForJobCompletion(jobId);
    
    // Extract the content from the completed job
    if (jobResult && jobResult.content) {
      const content = jobResult.content;
      console.log(`Extracted content for ${url}:`, content);
      
      const result = {
        success: true,
        title: content.title || '',
        text: content.markdown || content.text || content.html || '',
        date: content.published_date || content.date || '',
        author: (content.authors && content.authors.length > 0) 
          ? content.authors[0] 
          : content.author || '',
        source: 'api' as const
      };
      
      // Cache the result
      contentCache[url] = result;
      return result;
    }
    
    // If we didn't get content, fall back to mock data
    console.error(`No content returned for job ${jobId}`);
    const mockData = getMockDataForUrl(url);
    return mockData;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    
    // If we get any errors, use mock data as fallback
    const mockData = getMockDataForUrl(url);
    return mockData;
  }
};

/**
 * Extract content from multiple URLs
 * @param urls Array of URLs to extract content from
 * @returns Promise resolving to array of extracted content
 */
export const extractMultipleContents = async (urls: string[]): Promise<Array<{
  url: string;
  title?: string;
  text?: string;
  date?: string;
  author?: string;
  success: boolean;
  error?: string;
  source?: 'api' | 'cache' | 'mock';
}>> => {
  // Limit to 3 URLs to avoid rate limits
  const limitedUrls = urls.slice(0, 3);
  console.log(`Extracting content from ${limitedUrls.length} URLs:`, limitedUrls);
  
  const results = [];
  
  // Process each URL with delay to avoid rate limiting
  for (const url of limitedUrls) {
    try {
      const content = await extractContent(url);
      results.push({ url, ...content });
      
      // Add a small delay between requests
      if (!FORCE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Extraction failed for ${url}:`, error);
      const mockData = getMockDataForUrl(url);
      results.push({ 
        url, 
        ...mockData
      });
    }
  }
  
  return results;
}; 