interface Window {
  Calendly?: {
    initInlineWidget: (options: {
      url: string;
      parentElement: Element | null;
      prefill?: Record<string, any>;
      utm?: Record<string, any>;
    }) => void;
    initPopupWidget: (options: {
      url: string;
      prefill?: Record<string, any>;
      utm?: Record<string, any>;
    }) => void;
    initBadgeWidget: (options: {
      url: string;
      text: string;
      color: string;
      textColor: string;
    }) => void;
  };
} 