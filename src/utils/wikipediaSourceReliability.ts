import { calculateReliabilityScore } from "@/services/mediawikiService";
import { getEffectiveDomain } from "@/utils/domainUtils";
import { getWikipediaCitationCount, getCitationBasedReliability } from '@/services/mediawikiService';

// Map of domain names to Wikipedia reliability ratings
export interface SourceReliability {
  name: string;
  reliability: 'Generally reliable' | 'Generally unreliable' | 'No consensus' | 'Deprecated';
  score: number; // 10 for reliable, 5 for no consensus, 2 for unreliable, 0 for deprecated
  citationCount?: number;
  fromPredefinedList?: boolean;
}

// Create a map for quick lookup based on Wikipedia's reliability assessments
export const wikipediaSourceReliability: Record<string, SourceReliability> = {
  // Generally reliable sources (score 10)
  "nytimes.com": { name: "The New York Times", reliability: "Generally reliable", score: 10 },
  "washingtonpost.com": { name: "The Washington Post", reliability: "Generally reliable", score: 10 },
  "wsj.com": { name: "The Wall Street Journal", reliability: "Generally reliable", score: 10 },
  "reuters.com": { name: "Reuters", reliability: "Generally reliable", score: 10 },
  "apnews.com": { name: "Associated Press", reliability: "Generally reliable", score: 10 },
  "bbc.com": { name: "BBC", reliability: "Generally reliable", score: 10 },
  "bbc.co.uk": { name: "BBC", reliability: "Generally reliable", score: 10 },
  "theguardian.com": { name: "The Guardian", reliability: "Generally reliable", score: 10 },
  "economist.com": { name: "The Economist", reliability: "Generally reliable", score: 10 },
  "cnn.com": { name: "CNN", reliability: "Generally reliable", score: 10 },
  "nbcnews.com": { name: "NBC News", reliability: "Generally reliable", score: 10 },
  "abcnews.go.com": { name: "ABC News", reliability: "Generally reliable", score: 10 },
  "cbsnews.com": { name: "CBS News", reliability: "Generally reliable", score: 10 },
  "latimes.com": { name: "Los Angeles Times", reliability: "Generally reliable", score: 10 },
  "usatoday.com": { name: "USA Today", reliability: "Generally reliable", score: 10 },
  "time.com": { name: "Time", reliability: "Generally reliable", score: 10 },
  "bloomberg.com": { name: "Bloomberg", reliability: "Generally reliable", score: 10 },
  "ft.com": { name: "Financial Times", reliability: "Generally reliable", score: 10 },
  "theatlantic.com": { name: "The Atlantic", reliability: "Generally reliable", score: 10 },
  "newyorker.com": { name: "The New Yorker", reliability: "Generally reliable", score: 10 },
  "arstechnica.com": { name: "Ars Technica", reliability: "Generally reliable", score: 10 },
  "axios.com": { name: "Axios", reliability: "Generally reliable", score: 10 },
  "forbes.com": { name: "Forbes", reliability: "Generally reliable", score: 10 },
  "scientific-american": { name: "Scientific American", reliability: "Generally reliable", score: 10 },
  "amnesty.org": { name: "Amnesty International", reliability: "Generally reliable", score: 10 },
  "adl.org": { name: "Anti-Defamation League", reliability: "Generally reliable", score: 10 },
  "theage.com.au": { name: "The Age", reliability: "Generally reliable", score: 10 },
  "afp.com": { name: "Agence France-Presse", reliability: "Generally reliable", score: 10 },
  "aljazeera.com": { name: "Al Jazeera", reliability: "Generally reliable", score: 10 },
  "aon.com": { name: "Aon", reliability: "Generally reliable", score: 10 },
  "buzzfeednews.com": { name: "BuzzFeed News", reliability: "Generally reliable", score: 10 },
  "check-your-fact.com": { name: "Check Your Fact", reliability: "Generally reliable", score: 10 },
  "csmonitor.com": { name: "The Christian Science Monitor", reliability: "Generally reliable", score: 10 },
  "climatechange.org": { name: "Climate Feedback", reliability: "Generally reliable", score: 10 },
  "commonsensemedia.org": { name: "Common Sense Media", reliability: "Generally reliable", score: 10 },
  "theconversation.com": { name: "The Conversation", reliability: "Generally reliable", score: 10 },
  "deadline.com": { name: "Deadline Hollywood", reliability: "Generally reliable", score: 10 },
  "debretts.com": { name: "Debrett's", reliability: "Generally reliable", score: 10 },
  "denofgeek.com": { name: "Den of Geek", reliability: "Generally reliable", score: 10 },
  "deseretnews.com": { name: "Deseret News", reliability: "Generally reliable", score: 10 },
  "dw.com": { name: "Deutsche Welle", reliability: "Generally reliable", score: 10 },
  "digitalspy.com": { name: "Digital Spy", reliability: "Generally reliable", score: 10 },
  "digitaltrends.com": { name: "Digital Trends", reliability: "Generally reliable", score: 10 },
  "encyclopedia-iranica.com": { name: "Encyclopædia Iranica", reliability: "Generally reliable", score: 10 },
  "engadget.com": { name: "Engadget", reliability: "Generally reliable", score: 10 },
  "ew.com": { name: "Entertainment Weekly", reliability: "Generally reliable", score: 10 },
  "eurogamer.net": { name: "Eurogamer", reliability: "Generally reliable", score: 10 },
  "behindthevoiceactors.com": { name: "Behind the Voice Actors", reliability: "Generally reliable", score: 10 },
  "bellingcat.com": { name: "Bellingcat", reliability: "Generally reliable", score: 10 },
  "burkes-peerage.com": { name: "Burke's Peerage", reliability: "Generally reliable", score: 10 },
  "glaad.org": { name: "GLAAD", reliability: "Generally reliable", score: 10 },
  "gq.com": { name: "GQ", reliability: "Generally reliable", score: 10 },
  "haaretz.com": { name: "Haaretz", reliability: "Generally reliable", score: 10 },
  "hardcoregaming101.net": { name: "Hardcore Gaming 101", reliability: "Generally reliable", score: 10 },
  "hollywoodreporter.com": { name: "The Hollywood Reporter", reliability: "Generally reliable", score: 10 },
  "idolator.com": { name: "Idolator", reliability: "Generally reliable", score: 10 },
  "ign.com": { name: "IGN", reliability: "Generally reliable", score: 10 },
  "independent.co.uk": { name: "The Independent", reliability: "Generally reliable", score: 10 },
  "indianexpress.com": { name: "The Indian Express", reliability: "Generally reliable", score: 10 },
  "ips-dc.org": { name: "Inter Press Service", reliability: "Generally reliable", score: 10 },
  "theintercept.com": { name: "The Intercept", reliability: "Generally reliable", score: 10 },
  "jama-network.com": { name: "JAMA", reliability: "Generally reliable", score: 10 },
  "jpost.com": { name: "Jerusalem Post", reliability: "Generally reliable", score: 10 },
  "kommersant.ru": { name: "Kommersant", reliability: "Generally reliable", score: 10 },
  "kirkusreviews.com": { name: "Kirkus Reviews", reliability: "Generally reliable", score: 10 },
  "metacritic.com": { name: "Metacritic", reliability: "Generally reliable", score: 10 },
  "rottentomatoes.com": { name: "Rotten Tomatoes", reliability: "Generally reliable", score: 10 },
  "politico.com": { name: "Politico", reliability: "Generally reliable", score: 10 },
  "politifact.com": { name: "PolitiFact", reliability: "Generally reliable", score: 10 },
  "polygon.com": { name: "Polygon", reliability: "Generally reliable", score: 10 },
  "propublica.org": { name: "ProPublica", reliability: "Generally reliable", score: 10 },
  "rappler.com": { name: "Rappler", reliability: "Generally reliable", score: 10 },
  "reason.com": { name: "Reason", reliability: "Generally reliable", score: 10 },
  "theregister.com": { name: "The Register", reliability: "Generally reliable", score: 10 },
  "rollingstone.com": { name: "Rolling Stone (culture)", reliability: "Generally reliable", score: 10 },
  "rte.ie": { name: "RTÉ", reliability: "Generally reliable", score: 10 },
  "skepticalinquirer.org": { name: "Skeptical Inquirer", reliability: "Generally reliable", score: 10 },
  "sky.com": { name: "Sky News (UK)", reliability: "Generally reliable", score: 10 },
  "snopes.com": { name: "Snopes", reliability: "Generally reliable", score: 10 },
  "splcenter.org": { name: "Southern Poverty Law Center", reliability: "Generally reliable", score: 10 },
  "space.com": { name: "Space.com", reliability: "Generally reliable", score: 10 },
  "spiegel.de": { name: "Der Spiegel", reliability: "Generally reliable", score: 10 },
  "si.com": { name: "Sports Illustrated (pre-June 2019)", reliability: "Generally reliable", score: 10 },
  "smh.com.au": { name: "The Sydney Morning Herald", reliability: "Generally reliable", score: 10 },
  "torrentfreak.com": { name: "TorrentFreak", reliability: "Generally reliable", score: 10 },
  "tvguide.com": { name: "TV Guide", reliability: "Generally reliable", score: 10 },
  "usnews.com": { name: "U.S. News & World Report", reliability: "Generally reliable", score: 10 },
  "vanityfair.com": { name: "Vanity Fair", reliability: "Generally reliable", score: 10 },
  "variety.com": { name: "Variety", reliability: "Generally reliable", score: 10 },
  "venturebeat.com": { name: "VentureBeat", reliability: "Generally reliable", score: 10 },
  "theverge.com": { name: "The Verge", reliability: "Generally reliable", score: 10 },
  "villagevoice.com": { name: "The Village Voice", reliability: "Generally reliable", score: 10 },
  "vogue.com": { name: "Vogue", reliability: "Generally reliable", score: 10 },
  "voanews.com": { name: "Voice of America", reliability: "Generally reliable", score: 10 },
  "vox.com": { name: "Vox", reliability: "Generally reliable", score: 10 },
  "weeklystandard.com": { name: "The Weekly Standard", reliability: "Generally reliable", score: 10 },
  "thewire.in": { name: "The Wire (India)", reliability: "Generally reliable", score: 10 },
  "wired.com": { name: "Wired", reliability: "Generally reliable", score: 10 },
  "thewrap.com": { name: "TheWrap", reliability: "Generally reliable", score: 10 },
  "yahoo.com": { name: "Yahoo! News", reliability: "Generally reliable", score: 10 },

  // No consensus sources (score 5)
  "britannica.com": { name: "Encyclopædia Britannica", reliability: "No consensus", score: 5 },
  "quackwatch.org": { name: "Quackwatch", reliability: "No consensus", score: 5 },
  "allsides.com": { name: "AllSides", reliability: "No consensus", score: 5 },
  "cato.org": { name: "Cato Institute", reliability: "No consensus", score: 5 },
  "cepr.net": { name: "Center for Economic and Policy Research", reliability: "No consensus", score: 5 },
  "cosmopolitan.com": { name: "Cosmopolitan", reliability: "No consensus", score: 5 },
  "thedailybeast.com": { name: "The Daily Beast", reliability: "No consensus", score: 5 },
  "democracynow.org": { name: "Democracy Now!", reliability: "No consensus", score: 5 },
  "destructoid.com": { name: "Destructoid", reliability: "No consensus", score: 5 },
  "dexerto.com": { name: "Dexerto", reliability: "No consensus", score: 5 },
  "entrepreneur.com": { name: "Entrepreneur", reliability: "No consensus", score: 5 },
  "fair.org": { name: "Fairness and Accuracy in Reporting", reliability: "No consensus", score: 5 },
  "foxnews.com": { name: "Fox News (news excluding politics and science)", reliability: "No consensus", score: 5 },
  
  // Generally unreliable sources (score 2)
  "youtube.com": { name: "YouTube", reliability: "Generally unreliable", score: 2 },
  "facebook.com": { name: "Facebook", reliability: "Generally unreliable", score: 2 },
  "instagram.com": { name: "Instagram", reliability: "Generally unreliable", score: 2 },
  "reddit.com": { name: "Reddit", reliability: "Generally unreliable", score: 2 },
  "wikipedia.org": { name: "Wikipedia", reliability: "Generally unreliable", score: 2 },
  "imdb.com": { name: "IMDb", reliability: "Generally unreliable", score: 2 },
  "answers.com": { name: "Answers.com", reliability: "Generally unreliable", score: 2 },
  "quora.com": { name: "Quora", reliability: "Generally unreliable", score: 2 },
  "nypost.com": { name: "New York Post (excluding entertainment)", reliability: "Generally unreliable", score: 2 },
  "foxnews.com/politics": { name: "Fox News (politics and science)", reliability: "Generally unreliable", score: 2 },
  "foxnews.com/shows": { name: "Fox News (talk shows)", reliability: "Generally unreliable", score: 2 },
  "linkedin.com": { name: "LinkedIn", reliability: "Generally unreliable", score: 2 },
  "medium.com": { name: "Medium", reliability: "Generally unreliable", score: 2 },
  "twitter.com": { name: "Twitter", reliability: "Generally unreliable", score: 2 },
  "x.com": { name: "Twitter (X)", reliability: "Generally unreliable", score: 2 },
  "change.org": { name: "Change.org", reliability: "Generally unreliable", score: 2 },
  "gofundme.com": { name: "GoFundMe", reliability: "Generally unreliable", score: 2 },
  "kickstarter.com": { name: "Kickstarter", reliability: "Generally unreliable", score: 2 },
  "knowyourmeme.com": { name: "Know Your Meme", reliability: "Generally unreliable", score: 2 },
  "the-sun.com": { name: "The Sun", reliability: "Generally unreliable", score: 2 },
  "metro.co.uk": { name: "Metro (UK)", reliability: "Generally unreliable", score: 2 },
  "theonion.com": { name: "The Onion", reliability: "Generally unreliable", score: 2 },
  "blogspot.com": { name: "Blogger", reliability: "Generally unreliable", score: 2 },
  "wordpress.com": { name: "WordPress.com", reliability: "Generally unreliable", score: 2 },
  "amazon.com": { name: "Amazon", reliability: "Generally unreliable", score: 2 },
  "indiegogo.com": { name: "Indiegogo", reliability: "Generally unreliable", score: 2 },
  "thefederalist.com": { name: "The Federalist", reliability: "Generally unreliable", score: 2 },
  "washingtontimes.com": { name: "The Washington Times", reliability: "Generally unreliable", score: 2 },
  "tvtropes.org": { name: "TV Tropes", reliability: "Generally unreliable", score: 2 },
  "stackexchange.com": { name: "Stack Exchange", reliability: "Generally unreliable", score: 2 },
  "starsunfolded.com": { name: "StarsUnfolded", reliability: "Generally unreliable", score: 2 },
  "wikileaks.org": { name: "WikiLeaks", reliability: "Generally unreliable", score: 2 },
  "vgchartz.com": { name: "VGChartz", reliability: "Generally unreliable", score: 2 },
  "watchmojo.com": { name: "WatchMojo", reliability: "Generally unreliable", score: 2 },
  "whatculture.com": { name: "WhatCulture", reliability: "Generally unreliable", score: 2 },

  // Deprecated sources (score 0)
  "breitbart.com": { name: "Breitbart News", reliability: "Deprecated", score: 0 },
  "infowars.com": { name: "Infowars", reliability: "Deprecated", score: 0 },
  "rt.com": { name: "RT", reliability: "Deprecated", score: 0 },
  "sputniknews.com": { name: "Sputnik", reliability: "Deprecated", score: 0 },
  "dailymail.co.uk": { name: "Daily Mail", reliability: "Deprecated", score: 0 },
  "thegatewaypundit.com": { name: "The Gateway Pundit", reliability: "Deprecated", score: 0 },
  "zerohedge.com": { name: "Zero Hedge", reliability: "Deprecated", score: 0 },
  "dailycaller.com": { name: "The Daily Caller", reliability: "Deprecated", score: 0 },
  "nationalenquirer.com": { name: "National Enquirer", reliability: "Deprecated", score: 0 },
  "newsmax.com": { name: "Newsmax", reliability: "Deprecated", score: 0 },
  "oann.com": { name: "One America News Network", reliability: "Deprecated", score: 0 },
  "theunz.com": { name: "The Unz Review", reliability: "Deprecated", score: 0 },
  "theepochtimes.com": { name: "The Epoch Times", reliability: "Deprecated", score: 0 },
  "veteranstoday.com": { name: "Veterans Today", reliability: "Deprecated", score: 0 },
  "worldnetdaily.com": { name: "WorldNetDaily", reliability: "Deprecated", score: 0 },
  "wnd.com": { name: "WorldNetDaily", reliability: "Deprecated", score: 0 },
  "lifesitenews.com": { name: "LifeSiteNews", reliability: "Deprecated", score: 0 },
  "naturalnews.com": { name: "Natural News", reliability: "Deprecated", score: 0 },
  "globalresearch.ca": { name: "Centre for Research on Globalisation", reliability: "Deprecated", score: 0 },
  "telesurtv.net": { name: "Telesur", reliability: "Deprecated", score: 0 },
  "southfront.org": { name: "SouthFront", reliability: "Deprecated", score: 0 },
};

/**
 * Get reliability information for a URL, optionally with citation count
 * @param url URL to check reliability for
 * @param citationCount Optional citation count (if already known)
 * @returns Object with reliability information
 */
export function getSourceReliability(url: string, citationCount?: number): { 
  reliability: string; 
  description?: string;
  citationCount?: number;
} {
  try {
    // Extract domain from URL
    const domain = getEffectiveDomain(url);
    
    // Check our predefined list first
    for (const key in wikipediaSourceReliability) {
      if (domain === key || domain.endsWith(`.${key}`)) {
        return {
          reliability: wikipediaSourceReliability[key].reliability,
          description: wikipediaSourceReliability[key].description
        };
      }
    }
    
    // For domains not in our list, use citation count if provided
    if (citationCount !== undefined) {
      // Apply more realistic thresholds for Wikipedia citations
      if (citationCount >= 500) {
        return {
          reliability: "Generally reliable",
          description: `This source has ${citationCount} citations on Wikipedia, indicating widespread acceptance`,
          citationCount
        };
      } else if (citationCount >= 100) {
        return {
          reliability: "No consensus",
          description: `This source has ${citationCount} citations on Wikipedia`,
          citationCount
        };
      } else {
        return {
          reliability: "No consensus",
          description: `This source has only ${citationCount} citations on Wikipedia`,
          citationCount
        };
      }
    }
    
    // Default to "No consensus" if we don't have information
    return {
      reliability: "No consensus",
      description: "This source is not in our reliability database. Consider checking its reputation."
    };
  } catch (e) {
    return {
      reliability: "No consensus",
      description: "Unable to determine source reliability."
    };
  }
} 