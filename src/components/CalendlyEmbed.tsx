import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface CalendlyEmbedProps {
  score: number;
}

export function CalendlyEmbed({ score }: CalendlyEmbedProps) {
  // Use useEffect to load Calendly script
  useEffect(() => {
    // Load Calendly CSS
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(linkElement);

    // Load Calendly JS if not already loaded
    if (typeof window !== 'undefined' && !window.Calendly) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Function to open custom popup with description and Calendly
  const openCustomPopup = () => {
    if (typeof window !== 'undefined') {
      // Create modal background
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      modal.style.zIndex = '1000';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      
      // Close when clicking outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });
      
      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.style.backgroundColor = 'white';
      modalContent.style.borderRadius = '8px';
      modalContent.style.padding = '24px';
      modalContent.style.width = '90%';
      modalContent.style.maxWidth = '800px';
      modalContent.style.maxHeight = '90vh';
      modalContent.style.overflow = 'auto';
      modalContent.style.position = 'relative';
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '16px';
      closeButton.style.right = '16px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.fontSize = '24px';
      closeButton.style.cursor = 'pointer';
      closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
      
      // Add description
      const description = document.createElement('div');
      description.style.marginBottom = '24px';
      description.innerHTML = getDescriptionHTML();
      
      // Add Calendly container
      const calendlyContainer = document.createElement('div');
      calendlyContainer.style.height = '650px';
      
      // Append everything
      modalContent.appendChild(closeButton);
      modalContent.appendChild(description);
      modalContent.appendChild(calendlyContainer);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Initialize Calendly in the container
      if (window.Calendly) {
        window.Calendly.initInlineWidget({
          url: 'https://calendly.com/orani/30min',
          parentElement: calendlyContainer
        });
      }
    }
  };

  const getTitle = () => {
    if (score < 45) {
      return "You're Not Ready (Yet)";
    } else if (score < 65) {
      return "You're Close — But Not Quite There";
    } else {
      return "You Could be Eligible for a Wikipedia Page";
    }
  };

  const getDescriptionHTML = () => {
    if (score < 45) {
      return `
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">You're Not Ready (Yet)</h2>
        <p style="font-size: 16px; margin-bottom: 16px;">Wikipedia only allows pages about topics that meet its strict standards for notability and credibility. Right now, the available sources and public footprint around your name or brand aren't quite strong enough.</p>
        <p style="font-size: 16px; margin-bottom: 16px;">But here's the good news: you can build that credibility. With the right strategy—media coverage, high-authority citations, and a strong digital footprint—you can get there.</p>
        <p style="font-size: 16px; margin-bottom: 24px;"><strong>Book a free call</strong> to discuss how we can boost your online presence, credibility, and reputation—so you're ready for Wikipedia when it counts.</p>
      `;
    } else if (score < 65) {
      return `
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">You're Close — But Not Quite There</h2>
        <p style="font-size: 16px; margin-bottom: 16px;">You're on the right track. Your subject shows some signs of notability, but it needs a stronger foundation to meet Wikipedia's standards. A few more high-quality media mentions or third-party sources could make all the difference.</p>
        <p style="font-size: 16px; margin-bottom: 24px;"><strong>Book a free consultation</strong> and we'll show you how to build up your credibility, fill in the missing gaps, and get closer to Wikipedia eligibility without wasting time or money.</p>
      `;
    } else {
      return `
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">You Could be Eligible for a Wikipedia Page</h2>
        <p style="font-size: 16px; margin-bottom: 16px;">Your topic appears to meet the credibility and sourcing requirements Wikipedia editors look for. That's a strong position to be in—congrats.</p>
        <p style="font-size: 16px; margin-bottom: 24px;"><strong>Book a quick call</strong> to go over next steps. We'll help you fine-tune your narrative, identify the best sources to cite, and ensure you approach the process the right way—from draft to approval.</p>
      `;
    }
  };

  return (
    <Card className="my-3 mb-4 border border-primary/20 rounded-md newspaper-card">
      <CardContent className="p-3 pb-4 text-center">
        <Button 
          onClick={openCustomPopup}
          className="mx-auto py-2 px-4 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          {getTitle()}
        </Button>
      </CardContent>
    </Card>
  );
}