interface Window {
  Calendly?: {
    initPopupWidget: (options: { url: string }) => void;
    initInlineWidget: (options: { url: string, parentElement: Element }) => void;
    initBadgeWidget: (options: { url: string, text: string, color: string, textColor: string }) => void;
  };
}
