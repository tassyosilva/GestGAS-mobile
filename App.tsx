import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { garantirRastreamentoAtivo } from "./src/services/locationService";
import { Alert, AppState as RNAppState } from "react-native";

// IMPORTANTE: Importar a definição da task ANTES de qualquer coisa
import "./src/services/locationTaskDefinition";

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
  const appStateRef = useRef(RNAppState.currentState);

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

  // Gerenciar rastreamento quando app volta do background
  useEffect(() => {
    const subscription = RNAppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("App voltou para foreground - verificando rastreamento");

          // Se o usuário está autenticado, garantir que rastreamento está ativo
          if (appState === "authenticated") {
            try {
              await garantirRastreamentoAtivo();
            } catch (error) {
              console.error("Erro ao garantir rastreamento ativo:", error);
            }
          }
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [appState]);

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

        // Garantir que rastreamento está ativo após login com PIN
        try {
          await garantirRastreamentoAtivo();
        } catch (trackingError) {
          console.error("Erro ao iniciar rastreamento:", trackingError);
          // Não bloqueia o login se o rastreamento falhar
        }
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
