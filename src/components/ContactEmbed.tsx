import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, X } from 'lucide-react';

interface ContactEmbedProps {
  score: number;
}

export function ContactEmbed({ score }: ContactEmbedProps) {
  const [showPopup, setShowPopup] = useState(false);
  
  // Get button text based on score
  const getButtonText = () => {
    if (score < 45) {
      return "Contact Us";
    } else if (score < 65) {
      return "Get Consultation";
    } else {
      return "Discuss Next Steps";
    }
  };
  
  // Get content for the popup based on score
  const getPopupContent = () => {
    if (score < 45) {
      return (
        <>
          <h3 className="text-xl font-medium mb-4">You're Not Ready (Yet)</h3>
          <p className="mb-3">
            Wikipedia only allows pages about topics that meet its strict standards for notability and credibility. 
            Right now, the available sources and public footprint around your name or brand aren't quite strong enough.
          </p>
          <p className="mb-3">
            But here's the good news: you can build that credibility. With the right strategy—media coverage, 
            high-authority citations, and a strong digital footprint—you can get there.
          </p>
          <p className="mb-3">
            <strong>Contact us</strong> to discuss how we can boost your online presence, credibility, 
            and reputation—so you're ready for Wikipedia when it counts.
          </p>
        </>
      );
    } else if (score < 65) {
      return (
        <>
          <h3 className="text-xl font-medium mb-4">You're Close — But Not Quite There</h3>
          <p className="mb-3">
            You're on the right track. Your subject shows some signs of notability, but it needs 
            a stronger foundation to meet Wikipedia's standards. A few more high-quality media mentions 
            or third-party sources could make all the difference.
          </p>
          <p className="mb-3">
            <strong>Contact us</strong> and we'll show you how to build up your credibility, 
            fill in the missing gaps, and get closer to Wikipedia eligibility without wasting time or money.
          </p>
        </>
      );
    } else {
      return (
        <>
          <h3 className="text-xl font-medium mb-4">You Could be Eligible for a Wikipedia Page</h3>
          <p className="mb-3">
            Your topic appears to meet the credibility and sourcing requirements Wikipedia editors look for. 
            That's a strong position to be in—congrats.
          </p>
          <p className="mb-3">
            <strong>Contact us</strong> to go over next steps. We'll help you fine-tune your narrative, 
            identify the best sources to cite, and ensure you approach the process the right way—from draft to approval.
          </p>
        </>
      );
    }
  };
  
  return (
    <>
      <Card className="my-3 mb-4 border border-primary/20 rounded-md">
        <CardContent className="p-4 text-center">
          <Button 
            onClick={() => setShowPopup(true)}
            className="mx-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {getButtonText()}
          </Button>
        </CardContent>
      </Card>
      
      {/* Contact Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            
            {getPopupContent()}
            
            <div className="mt-6 text-center">
              <p className="mb-4 text-gray-700">
                Email us at <a href="mailto:orani@reputationcitadel.com" className="text-blue-600 hover:underline">orani@reputationcitadel.com</a>
              </p>
              <Button 
                onClick={() => setShowPopup(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 