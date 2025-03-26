import { WikipediaEligibility, SourcesAnalysisTab, WikipediaDraftTab } from './WikipediaEligibility';

<Tabs defaultValue="eligibility">
  <TabsList className="mb-4">
    <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
    <TabsTrigger value="sources">Sources</TabsTrigger>
    <TabsTrigger value="wikipediaDraft">Wikipedia Draft</TabsTrigger>
  </TabsList>
  
  <TabsContent value="eligibility">
    <WikipediaEligibility result={result} query={query} />
  </TabsContent>
  
  <TabsContent value="sources">
    <SourcesAnalysisTab result={result} />
  </TabsContent>
  
  <TabsContent value="wikipediaDraft">
    <WikipediaDraftTab />
  </TabsContent>
</Tabs> 