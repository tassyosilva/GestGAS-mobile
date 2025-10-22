import React, { useState, useEffect, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import ConfiguracaoInicialScreen from "./src/screens/ConfiguracaoInicialScreen";
import PinScreen from "./src/screens/PinScreen";
import MinhasEntregasScreen from "./src/screens/MinhasEntregasScreen";
import DetalhesPedidoScreen from "./src/screens/DetalhesPedidoScreen";
import { authService } from "./src/services/authService";
import { storageService } from "./src/services/storageService";
import { Alert } from "react-native";

// 1. Definição dos tipos das rotas e seus parâmetros
type RootStackParamList = {
  ConfiguracaoInicial: undefined; // Não recebe parâmetros
  CreatePin: undefined;
  VerifyPin: undefined;
  MinhasEntregas: undefined;
  DetalhesPedido: { pedidoId: number }; // Recebe um pedidoId
};

// 2. Criação dos tipos específicos das props para cada tela inline
type ConfiguracaoInicialProps = NativeStackScreenProps<
  RootStackParamList,
  "ConfiguracaoInicial"
>;
type CreatePinProps = NativeStackScreenProps<RootStackParamList, "CreatePin">;
type VerifyPinProps = NativeStackScreenProps<RootStackParamList, "VerifyPin">;
type MinhasEntregasProps = NativeStackScreenProps<
  RootStackParamList,
  "MinhasEntregas"
>;

const Stack = createNativeStackNavigator<RootStackParamList>(); // Tipado o Stack Navigator

type AppState =
  | "loading"
  | "needsConfig"
  | "needsPin"
  | "createPin"
  | "authenticated";

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");

  // Usamos useCallback para checkInitialState para evitar recriação desnecessária
  const checkInitialState = useCallback(async () => {
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
      setAppState("needsConfig"); // Garante um estado inicial seguro em caso de erro
    }
  }, []); // Array vazio pois não depende de nada externo que mude

  useEffect(() => {
    checkInitialState();
  }, [checkInitialState]); // Adicionada dependência

  const handleConfigComplete = useCallback(() => {
    setAppState("createPin");
  }, []);

  const handlePinCreated = useCallback(() => {
    setAppState("authenticated");
  }, []);

  // Usamos useCallback para handleForgotPin
  const handleForgotPin = useCallback(() => {
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
  }, []); // Array vazio

  const handlePinVerified = useCallback(async () => {
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
              onPress: handleForgotPin, // Reutiliza a função
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
            onPress: handleForgotPin, // Reutiliza a função
          },
        ],
      );
    }
  }, [handleForgotPin]); // Adicionada dependência

  const handleLogout = useCallback(async () => {
    await authService.logout();
    const hasPin = await storageService.hasPin();
    if (hasPin) {
      setAppState("needsPin");
    } else {
      setAppState("needsConfig");
    }
  }, []);

  if (appState === "loading") {
    return null; // Ou um componente de Loading
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {appState === "needsConfig" ? (
          <Stack.Screen name="ConfiguracaoInicial">
            {/* 3. Tipo adicionado às props */}
            {(props: ConfiguracaoInicialProps) => (
              <ConfiguracaoInicialScreen
                {...props}
                onConfigComplete={handleConfigComplete}
              />
            )}
          </Stack.Screen>
        ) : appState === "createPin" ? (
          <Stack.Screen name="CreatePin">
            {/* 3. Tipo adicionado às props */}
            {(props: CreatePinProps) => (
              <PinScreen
                {...props}
                mode="create"
                onSuccess={handlePinCreated}
              />
            )}
          </Stack.Screen>
        ) : appState === "needsPin" ? (
          <Stack.Screen name="VerifyPin">
            {/* 3. Tipo adicionado às props */}
            {(props: VerifyPinProps) => (
              <PinScreen
                {...props}
                mode="verify"
                onSuccess={handlePinVerified}
                onCancel={handleForgotPin} // Reutiliza a função
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MinhasEntregas">
              {/* 3. Tipo adicionado às props */}
              {(props: MinhasEntregasProps) => (
                <MinhasEntregasScreen {...props} onLogout={handleLogout} />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="DetalhesPedido"
              component={DetalhesPedidoScreen}
              // Não precisa de tipo aqui porque não é inline
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
