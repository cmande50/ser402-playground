import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import TogglePage from './components/TogglePage';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route 
          path="/toggle" 
          element={isAuthenticated ? <TogglePage /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
