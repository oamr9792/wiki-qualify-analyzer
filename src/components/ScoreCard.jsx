const ScoreCard = ({ score, isEligible, reason }) => {
  // Determine which button text to show based on score
  const getCtaButtonText = () => {
    if (score >= 65) {
      return "Book a Free Call";
    } else if (score >= 45) {
      return "Book a Free Consultation";
    } else {
      return "Book a Free Call";
    }
  };

  return (
    <div className="score-card">
      <div className="left-section">
        <button className="action-cta-button">
          {getCtaButtonText()}
        </button>
      </div>
      
      <div className="right-section">
        <div className="score-label">Score</div>
        <div className="score-value">{score}</div>
      </div>
    </div>
  );
};

export default ScoreCard; 