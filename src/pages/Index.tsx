import React from "react";
import { UnifiedSearch } from "@/components/UnifiedSearch";

const Index = () => {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-220px)]">
      {/* Reduced vertical padding and added flexbox centering */}
      <div className="py-8 text-center bg-white mb-4 max-w-3xl">
        <h1 className="text-4xl font-light tracking-tight text-gray-800 font-sans mb-2">
          Wikipedia Eligibility Analyser
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-gray-500 font-sans leading-relaxed">
          Analyze your online presence and determine Wikipedia eligibility based on source reliability
        </p>
      </div>
      
      <UnifiedSearch />
    </div>
  );
};

export default Index;
