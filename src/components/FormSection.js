// FormSection.js — shared numbered step card (step badge, title, optional
// subtitle, body) used by the report-generator tools for a consistent layout.
import React from 'react';

// Numbered section card shared by the report-generator tools so they match.
const FormSection = ({ step, title, subtitle, children }) => (
    <section className="form-section">
        <div className="form-section-head">
            <span className="form-section-step">{step}</span>
            <div>
                <h2>{title}</h2>
                {subtitle && <span className="form-section-sub">{subtitle}</span>}
            </div>
        </div>
        <div className="form-section-body">{children}</div>
    </section>
);

export default FormSection;
