import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Analytics } from "@vercel/analytics/react";
import './App.css';
import Index from './pages/Index';
import { ThemeProvider } from '@/components/ThemeProvider';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme="reputationCitadel">
        <TooltipProvider>
          <Router>
            <main className="container mx-auto py-4 px-4">
              <Routes>
                <Route path="/" element={<Index />} />
              </Routes>
            </main>
            <footer className="mt-16 py-6 border-t border-gray-300">
              <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                <p className="font-serif italic">© www.reputationcitadel.com 2025 All rights reserved.</p>
              </div>
            </footer>
          </Router>
        </TooltipProvider>
        <Analytics />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
