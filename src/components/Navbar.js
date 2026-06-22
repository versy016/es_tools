import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import '../stylessheets/Navbar.css';

const NavBar = ({ userName, signOut }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const menuRef = useRef(null);

  const initial = (userName || 'U').trim().charAt(0).toUpperCase();

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setDropdownVisible(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/images/logo.png" alt="Engineering Surveys" className="navbar-logo" />
        <span className="navbar-title">ES&nbsp;Tools</span>
      </div>

      <div className="navbar-right" ref={menuRef}>
        <button type="button" className="navbar-profile" onClick={() => setDropdownVisible((v) => !v)}>
          <span className="navbar-avatar">{initial}</span>
          <span className="navbar-username">{userName || 'User'}</span>
        </button>
        {dropdownVisible && (
          <div className="dropdown-menu">
            <p className="dropdown-hello">Signed in as<br /><strong>{userName || 'User'}</strong></p>
            <button className="dropdown-signout" onClick={signOut}>
              <FontAwesomeIcon icon={faRightFromBracket} /> Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
