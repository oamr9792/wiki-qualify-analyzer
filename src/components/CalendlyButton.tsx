import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

const BOOKING_URL = 'https://calendar.app.google/2wyWnzWZyr7qMpHC9';

const CalendlyButton: React.FC = () => {
  return (
    <Button
      onClick={() => window.open(BOOKING_URL, '_blank')}
      className="mx-auto py-2 px-4 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
    >
      <Calendar className="h-4 w-4" />
      Schedule a Consultation
    </Button>
  );
};

export default CalendlyButton;
