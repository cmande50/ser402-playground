import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/global.css';

const TogglePage = () => {
  const [isOn, setIsOn] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleToggle = () => {
    setIsOn(!isOn);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={`page toggle-page ${isOn ? 'light-on' : 'light-off'}`}>
      <div className="header">
        {user && (
          <div className="user-info">
            <span>Welcome, {user.name}</span>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>
      
      <div className="toggle-container">
        <h1>Server Switch</h1>
        <div className="light-switch">
          <div 
            className={`switch ${isOn ? 'on' : 'off'}`} 
            onClick={handleToggle}
          >
            <div className="switch-plate">
              <div className="switch-handle"></div>
            </div>
          </div>
          <div className={`lamp ${isOn ? 'on' : 'off'}`}>
          </div>
        </div>
        <p>The server is currently {isOn ? 'ON' : 'OFF'}</p>
      </div>
    </div>
  );
};

export default TogglePage;
