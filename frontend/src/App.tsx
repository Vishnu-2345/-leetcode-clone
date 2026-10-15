import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProblemsPage from './pages/ProblemsPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import SubmissionsPage from './pages/SubmissionsPage';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="problems/:slug" element={<ProblemDetailPage />} />
        <Route path="login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/problems" />} />
        <Route path="register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/problems" />} />
        <Route
          path="profile"
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />}
        />
        <Route
          path="submissions"
          element={isAuthenticated ? <SubmissionsPage /> : <Navigate to="/login" />}
        />
      </Route>
    </Routes>
  );
}

export default App;
