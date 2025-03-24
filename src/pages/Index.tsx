
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ArrowRight, Info, BarChart, FileText, Award } from "lucide-react";
import { WikipediaMetrics, analyzeWikipediaEligibility } from "@/services/api";
import ScoreGauge from "@/components/ScoreGauge";
import AnalysisCard from "@/components/AnalysisCard";
import DetailedFactors from "@/components/DetailedFactors";
import SuggestionsCard from "@/components/SuggestionsCard";
import { toast } from "sonner";

const Index = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<WikipediaMetrics | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error("Please enter a URL or topic to analyze");
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await analyzeWikipediaEligibility(url);
      setMetrics(result);
      setActiveTab("overview");
      toast.success("Analysis complete");
    } catch (error) {
      // Error is handled in the API function
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
        {/* Header */}
        <div className="w-full text-center mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-2">
            Wikipedia Eligibility Analyzer
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Analyze if a subject meets Wikipedia's notability guidelines. Enter a URL or topic name.
          </p>
        </div>
        
        {/* Search form */}
        <Card className="w-full mb-8 overflow-hidden backdrop-blur-sm bg-white/50 border-white/20 shadow-lg animate-blur-in">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL or topic name (e.g., Elon Musk, Tesla Inc.)"
                  className="pl-10 py-6 bg-white/70"
                  disabled={loading}
                />
              </div>
              <Button 
                type="submit" 
                className="py-6 px-8 transition-all" 
                disabled={loading}
              >
                {loading ? (
                  "Analyzing..."
                ) : (
                  <>
                    Analyze <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Results */}
        {metrics && (
          <div className="w-full space-y-6 animate-fade-in">
            {/* Overall score */}
            <div className="flex flex-col items-center justify-center text-center mb-4">
              <div className="flex flex-col items-center">
                <ScoreGauge score={metrics.eligibilityScore} size="lg" animated />
                <h2 className="text-xl font-medium mt-2">
                  Overall Eligibility Score
                </h2>
                <p className="text-muted-foreground mt-1 max-w-md">
                  {metrics.eligibilityScore >= 0.7
                    ? "Likely meets Wikipedia notability guidelines"
                    : metrics.eligibilityScore >= 0.4
                    ? "May need improvements to meet notability guidelines"
                    : "Unlikely to meet current notability guidelines"}
                </p>
              </div>
            </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full max-w-md mx-auto grid grid-cols-3 mb-4">
                <TabsTrigger value="overview" className="flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-1">
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Detailed Analysis</span>
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Suggestions</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0 w-full animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AnalysisCard
                    title="Notability"
                    score={metrics.notability.score}
                    description={metrics.notability.description}
                  />
                  <AnalysisCard
                    title="References"
                    score={metrics.references.quality}
                    description={`${metrics.references.count} references. ${metrics.references.description}`}
                  />
                  <AnalysisCard
                    title="Content Quality"
                    score={metrics.contentQuality.score}
                    description={metrics.contentQuality.description}
                  />
                </div>
              </TabsContent>
              
              {/* Details Tab */}
              <TabsContent value="details" className="mt-0 w-full animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailedFactors
                    title="Notability Factors"
                    factors={[
                      { name: "Relevance", value: metrics.notability.factors.relevance },
                      { name: "Recognition", value: metrics.notability.factors.recognition },
                      { name: "Impact", value: metrics.notability.factors.impact },
                    ]}
                  />
                  <DetailedFactors
                    title="Reference Quality"
                    factors={[
                      { name: "Quality", value: metrics.references.quality },
                      { name: "Diversity", value: metrics.references.diversity },
                      { name: "Reliability", value: metrics.references.reliability },
                    ]}
                  />
                  <DetailedFactors
                    title="Content Assessment"
                    factors={[
                      { name: "Neutrality", value: metrics.contentQuality.factors.neutrality },
                      { name: "Comprehensiveness", value: metrics.contentQuality.factors.comprehensiveness },
                      { name: "Structure", value: metrics.contentQuality.factors.structure },
                    ]}
                    className="md:col-span-2"
                  />
                </div>
              </TabsContent>
              
              {/* Suggestions Tab */}
              <TabsContent value="suggestions" className="mt-0 w-full animate-fade-in">
                <SuggestionsCard suggestions={metrics.suggestions} />
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {/* Footer */}
        <div className="w-full text-center mt-16 text-sm text-muted-foreground">
          <p>
            This tool analyzes Wikipedia eligibility based on notability guidelines. Results are for guidance only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
