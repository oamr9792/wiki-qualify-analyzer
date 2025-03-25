import React from 'react';
import { Search } from '@/components/Search';
import { RealSearch } from '@/components/RealSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SearchPage: React.FC = () => {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Search Engine Results</h1>
      
      <Tabs defaultValue="direct">
        <TabsList className="mb-6">
          <TabsTrigger value="direct">Direct Search</TabsTrigger>
          <TabsTrigger value="component">Search Component</TabsTrigger>
        </TabsList>
        
        <TabsContent value="direct">
          <RealSearch />
        </TabsContent>
        
        <TabsContent value="component">
          <Search />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchPage; 