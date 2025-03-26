/**
 * Service for interacting with OpenAI API to generate content
 */

// Updated API key
const OPENAI_API_KEY = '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';

/**
 * Generate Wikipedia draft using OpenAI with the specific prompt
 */
export const generateWikipediaDraftWithOpenAI = async (
  query: string, 
  sources: any[],
  maxRetries = 3,  // Maximum number of retry attempts 
  initialDelay = 2000  // Initial delay in milliseconds
): Promise<string> => {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`Generating Wikipedia draft with OpenAI (attempt ${retryCount + 1})...`);
      
      // Create a structured list of sources
      const sourcesList = sources.map(source => {
        return `- ${source.domain} (${source.category}): ${source.url}`;
      }).join('\n');
      
      // Update the system prompt to emphasize numbered footnotes
      const systemPrompt = 'You are a professional Wikipedia editor skilled at creating well-structured, neutral articles. Include numbered footnote citations (e.g. [1], [2], etc.) throughout the article wherever facts are cited. Format the article in Markdown with a References section at the end that lists all the sources with their corresponding numbers.';
      
      // Update the user prompt to specifically request footnotes
      const prompt = `Using only the list of reliable sources found for this topic "${query}", please write a draft wikipedia page, adhering to wikipedia guidelines.

Key requirements:
1. Use numbered footnote citations (e.g. [1], [2]) throughout the text
2. Include in-text citations for all factual statements
3. Create a proper References section at the end listing all sources
4. Format in Markdown with appropriate sections and headings

Reliable sources:
${sourcesList}`;
      
      // Make the API request to OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Using 3.5 turbo instead of 4 to avoid rate limits
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      
      if (response.status === 429) {
        // Rate limit hit, extract retry time from error if available
        const errorData = await response.json();
        console.log(`Rate limit hit:`, errorData);
        
        // Calculate delay with exponential backoff
        const delay = initialDelay * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay/1000} seconds...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the generated text from the response
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      
      throw new Error('No content in OpenAI response');
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Attempt ${retryCount + 1} failed, retrying...`);
        const delay = initialDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      } else {
        console.error('Max retry attempts reached for OpenAI:', error);
        return `# ${query}\n\nUnable to generate Wikipedia draft at this time. The AI service is currently experiencing high demand. Please try again in a few minutes.`;
      }
    }
  }
  
  // This return is reached if all retries fail
  return `# ${query}\n\nUnable to generate Wikipedia draft after multiple attempts. Please try again later.`;
};

// For backward compatibility
export const generateWikipediaDraftOpenAI = generateWikipediaDraftWithOpenAI; 