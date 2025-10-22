import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConfiguracaoInicialScreen from "./src/screens/ConfiguracaoInicialScreen";
import PinScreen from "./src/screens/PinScreen";
import MinhasEntregasScreen from "./src/screens/MinhasEntregasScreen";
import DetalhesPedidoScreen from "./src/screens/DetalhesPedidoScreen";
import { authService } from "./src/services/authService";
import { storageService } from "./src/services/storageService";
import { Alert } from "react-native";

const Stack = createNativeStackNavigator();

type AppState =
  | "loading"
  | "needsConfig"
  | "needsPin"
  | "createPin"
  | "authenticated";

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      await authService.initialize();

      const hasPin = await storageService.hasPin();
      const hasCredentials = await storageService.getCredentials();

      if (!hasCredentials) {
        setAppState("needsConfig");
      } else if (!hasPin) {
        setAppState("createPin");
      } else {
        setAppState("needsPin");
      }
    } catch (error) {
      console.error("Erro ao verificar estado inicial:", error);
      setAppState("needsConfig");
    }
  };

  const handleConfigComplete = () => {
    setAppState("createPin");
  };

  const handlePinCreated = () => {
    setAppState("authenticated");
  };

  const handlePinVerified = async () => {
    try {
      const success = await authService.loginWithCredentials();
      if (success) {
        setAppState("authenticated");
      } else {
        Alert.alert(
          "Erro",
          "Não foi possível fazer login. Suas credenciais podem estar inválidas.",
          [
            {
              text: "Reconfigurar",
              onPress: handleForgotPin,
            },
          ],
        );
      }
    } catch (error) {
      console.error("Erro ao fazer login com PIN:", error);
      Alert.alert(
        "Erro",
        "Não foi possível fazer login. Verifique sua conexão.",
        [
          {
            text: "Tentar novamente",
            onPress: () => setAppState("needsPin"),
          },
          {
            text: "Reconfigurar",
            onPress: handleForgotPin,
          },
        ],
      );
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      "Reconfigurar Acesso",
      "Isso irá apagar seus dados salvos e você precisará configurar o acesso novamente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: "destructive",
          onPress: async () => {
            await storageService.clear();
            setAppState("needsConfig");
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await authService.logout();
    const hasPin = await storageService.hasPin();
    if (hasPin) {
      setAppState("needsPin");
    } else {
      setAppState("needsConfig");
    }
  };

  if (appState === "loading") {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {appState === "needsConfig" ? (
          <Stack.Screen name="ConfiguracaoInicial">
            {(props) => (
              <ConfiguracaoInicialScreen
                {...props}
                onConfigComplete={handleConfigComplete}
              />
            )}
          </Stack.Screen>
        ) : appState === "createPin" ? (
          <Stack.Screen name="CreatePin">
            {(props) => (
              <PinScreen
                {...props}
                mode="create"
                onSuccess={handlePinCreated}
              />
            )}
          </Stack.Screen>
        ) : appState === "needsPin" ? (
          <Stack.Screen name="VerifyPin">
            {(props) => (
              <PinScreen
                {...props}
                mode="verify"
                onSuccess={handlePinVerified}
                onCancel={handleForgotPin}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MinhasEntregas">
              {(props) => (
                <MinhasEntregasScreen {...props} onLogout={handleLogout} />
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
