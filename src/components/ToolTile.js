// ToolTile.js — dashboard tool card. Renders in grid or list form, shows a
// live/coming-soon status pill and a favourite toggle; clicking opens the tool.
import React from 'react';

// Favourite indicator star — filled when `on`.
const Star = ({ on }) => (
    <svg viewBox="0 0 24 24" width="20" height="20"
        fill={on ? '#F5A623' : 'none'} stroke={on ? '#F5A623' : '#C7BFAE'} strokeWidth="1.6">
        <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.8 5.2 21l1.5-7L1.5 9.3l7-.8z" />
    </svg>
);

// A tool card on the dashboard. `view` = 'grid' | 'list'.
const ToolTile = ({ tool, fav, onToggleFav, onOpen, view = 'grid' }) => {
    const badge = (
        <div className="tile-badge" style={{ background: tool.badgeBg, color: tool.badgeFg }}>{tool.mono}</div>
    );
    // Live tools show their tag; not-yet-built tools show a muted "Coming soon".
    const statusPill = tool.live
        ? <span className="pill pill-live"><span className="dot" />{tool.tag}</span>
        : <span className="pill pill-soon">Coming soon</span>;

    // stopPropagation so favouriting doesn't also trigger the tile's open handler.
    const favBtn = (
        <button type="button" className="tile-fav" onClick={(e) => { e.stopPropagation(); onToggleFav(tool.id); }}
            aria-label={fav ? 'Unfavourite' : 'Favourite'}>
            <Star on={fav} />
        </button>
    );

    if (view === 'list') {
        return (
            <div className={`tool-row ${tool.live ? 'live' : 'soon'}`} onClick={() => onOpen(tool)}>
                {badge}
                <div className="tool-row-text">
                    <div className="tool-row-name">{tool.name}</div>
                    <div className="tool-row-desc">{tool.desc}</div>
                </div>
                {statusPill}
                {favBtn}
            </div>
        );
    }

    return (
        <div className={`tool-tile ${tool.live ? 'live' : 'soon'}`} onClick={() => onOpen(tool)}>
            <div className="tile-top">
                {badge}
                {favBtn}
            </div>
            <div className="tile-name">{tool.name}</div>
            <div className="tile-desc">{tool.desc}</div>
            {statusPill}
        </div>
    );
};

export default ToolTile;
