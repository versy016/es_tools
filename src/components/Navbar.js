import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import '../stylessheets/Navbar.css';

const NavBar = ({ userName, signOut }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <img src="/images/logo.png" alt="Engineering Surveys Logo" />
      </div>
      <ul className="navbar-links">
        <li><a href="#dashboard">ES Tools</a></li>
   
      </ul>
      <div className="navbar-icons">
        <FontAwesomeIcon icon={faCog} className="navbar-icon" />
        <div className="navbar-profile-container" onClick={toggleDropdown}>
          <img src="/images/profile.jpg" alt="User Profile" className="navbar-profile" />
          {dropdownVisible && (
            <div className="dropdown-menu">
              <p>Hello, {userName}</p>
              <button onClick={signOut}>Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
