import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import FullScreenLoader from '../components/FullScreenLoader';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
