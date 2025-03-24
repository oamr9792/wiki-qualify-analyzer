
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="glass p-8 rounded-lg text-center max-w-md mx-auto animate-scale-in">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-foreground mb-6">The page you're looking for doesn't exist.</p>
        <Button asChild className="transition-all">
          <a href="/" className="flex items-center">
            <Home className="mr-2 h-4 w-4" />
            Return Home
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
