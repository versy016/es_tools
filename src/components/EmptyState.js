// EmptyState.js — reusable empty-state placeholder (icon, title, optional
// subtitle and action) used across list screens when there's nothing to show.
import React from 'react';

// Placeholder shown when a screen has no data yet.
const EmptyState = ({ icon, title, sub, action }) => (
    <div className="empty-state">
        {icon && <div className="empty-state-icon">{icon}</div>}
        <div className="empty-state-title">{title}</div>
        {sub && <div className="empty-state-sub">{sub}</div>}
        {action && <div className="empty-state-action">{action}</div>}
    </div>
);

export default EmptyState;
