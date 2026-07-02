import React from 'react';
import './Spinner.css';

// Small reusable spinning indicator. Drop it anywhere an action is in flight:
//   <Spinner />                     (18px, on light backgrounds)
//   <Spinner size={14} />           (inline in a button/label)
//   <Spinner light size={24} />     (on a dark/overlay background)
const Spinner = ({ size = 18, light = false, className = '' }) => (
    <span
        className={`es-spinner${light ? ' es-spinner-light' : ''}${className ? ' ' + className : ''}`}
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
        role="status"
        aria-label="Loading"
    />
);

export default Spinner;
