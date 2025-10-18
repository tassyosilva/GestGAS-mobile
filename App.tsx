import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConfiguracaoInicialScreen from './src/screens/ConfiguracaoInicialScreen';
import MinhasEntregasScreen from './src/screens/MinhasEntregasScreen';
import DetalhesPedidoScreen from './src/screens/DetalhesPedidoScreen';
import { authService } from './src/services/authService';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await authService.initialize();
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      setIsAuthenticated(false);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="ConfiguracaoInicial">
            {(props) => (
              <ConfiguracaoInicialScreen
                {...props}
                onConfigComplete={handleLogin}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MinhasEntregas">
              {(props) => (
                <MinhasEntregasScreen
                  {...props}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="DetalhesPedido"
              component={DetalhesPedidoScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}