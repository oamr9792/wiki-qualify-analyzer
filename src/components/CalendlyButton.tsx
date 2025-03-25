import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

const CalendlyButton: React.FC = () => {
  useEffect(() => {
    // Load Calendly script
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);
    
    // Clean up
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const openCalendly = () => {
    // Check if Calendly is loaded
    if (typeof window !== 'undefined' && (window as any).Calendly) {
      (window as any).Calendly.initPopupWidget({
        url: 'https://calendly.com/orani/30min'
      });
    } else {
      // Fallback to opening the Calendly page directly
      window.open('https://calendly.com/orani/30min', '_blank');
    }
  };

  return (
    <Button 
      onClick={openCalendly}
      className="mx-auto py-2 px-4 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
    >
      <Calendar className="h-4 w-4" />
      Schedule a Consultation
    </Button>
  );
};

export default CalendlyButton; 