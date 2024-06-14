import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import '../stylessheets/ToolCard.css';

const ToolCard = ({ image, title, description, onClick }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const toggleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  

  return (
    <div className={`tool-card ${isFlipped ? 'flipped' : ''}`}>
      <div className="tool-card-front">
        <img src={image} alt={title} className="tool-card-image" />
        <h3 className="tool-card-title" onClick={onClick}>{title}</h3>
        <FontAwesomeIcon icon={faInfoCircle} className="info-icon" onClick={toggleFlip} />
      </div>
      <div className="tool-card-back">
        <p className="tool-card-description">{description}</p>
        <button className="tool-card-button" onClick={toggleFlip} style={{ margin: '1rem' }}>Back</button>
      </div>
    </div>
  );
};

export default ToolCard;
