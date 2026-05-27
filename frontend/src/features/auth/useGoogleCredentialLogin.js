import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDefaultRouteByRole } from '@shared/utils/roleRedirect';
import { useAuth } from './AuthContext';
import { authApi } from './auth.api';

export function useGoogleCredentialLogin({ setError, setLoading, fallbackMessage = 'Không thể đăng nhập bằng Google' } = {}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  return useCallback(async (response) => {
    setError?.('');
    setLoading?.(true);

    try {
      if (!response?.credential) {
        throw new Error('Không nhận được mã xác thực Google.');
      }

      const data = await authApi.googleLogin(response.credential);
      login(data.token, data.user);
      navigate(getDefaultRouteByRole(data.user.role_code));
    } catch (err) {
      setError?.(err.message || fallbackMessage);
    } finally {
      setLoading?.(false);
    }
  }, [fallbackMessage, login, navigate, setError, setLoading]);
}
