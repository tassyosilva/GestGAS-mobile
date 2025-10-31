import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/authService";
import axios from "axios";
import { garantirRastreamentoAtivo } from "../services/locationService";

interface Props {
  onConfigComplete: () => void;
}

export default function ConfiguracaoInicialScreen({ onConfigComplete }: Props) {
  const [serverUrl, setServerUrl] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // CORREÇÃO 1: Adicionar ref de montagem
  const isMountedRef = useRef(true);

  // CORREÇÃO 2: Cleanup ao desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const normalizeServerUrl = (url: string): string => {
    let normalized = url.trim();

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    }

    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(normalized);

    if (isIpAddress) {
      return `http://${normalized}`;
    } else {
      return `https://${normalized}`;
    }
  };

  const validarUrl = (url: string): { valida: boolean; mensagem: string } => {
    if (!url || url.trim().length === 0) {
      return { valida: false, mensagem: "Digite o endereço web da empresa" };
    }

    const normalizedUrl = normalizeServerUrl(url);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const urlValida = new URL(normalizedUrl);
      return { valida: true, mensagem: "" };
    } catch {
      return {
        valida: false,
        mensagem: "URL inválida. Verifique o formato do endereço",
      };
    }
  };

  const testConnection = async () => {
    const validacao = validarUrl(serverUrl);
    if (!validacao.valida) {
      Alert.alert("Erro", validacao.mensagem);
      return;
    }

    if (!isMountedRef.current) return;
    setTestingConnection(true);

    try {
      const url = normalizeServerUrl(serverUrl);

      console.log("Testando conexão com:", url);

      // CORREÇÃO 3: Aumentar timeout para redes locais
      const response = await axios.get(`${url}/api/health`, {
        timeout: 10000, // 10 segundos
        validateStatus: (status) => status < 500,
      });

      console.log("Resposta do servidor:", response.status);

      if (isMountedRef.current) {
        if (response.status === 200 || response.status === 404) {
          Alert.alert("Sucesso", "Conexão com o servidor estabelecida!");
        } else {
          Alert.alert(
            "Aviso",
            `Servidor respondeu com status ${response.status}. Você pode tentar fazer login.`,
          );
        }
      }
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);

      if (!isMountedRef.current) return;

      let errorMessage = "Não foi possível conectar ao servidor.";

      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        errorMessage =
          "Tempo de conexão esgotado. Verifique o endereço e sua internet.";
      } else if (
        error.message?.includes("Network Error") ||
        error.code === "ERR_NETWORK"
      ) {
        errorMessage = "Erro de rede. Verifique sua conexão com a internet.";
      } else if (error.message?.includes("ENOTFOUND")) {
        errorMessage =
          "Servidor não encontrado. Verifique se o endereço está correto.";
      } else if (error.response) {
        errorMessage = `Servidor respondeu com erro ${error.response.status}. O servidor pode estar temporariamente indisponível.`;
      }

      Alert.alert("Erro de Conexão", errorMessage);
    } finally {
      if (isMountedRef.current) {
        setTestingConnection(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!serverUrl || !login || !senha) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    const validacao = validarUrl(serverUrl);
    if (!validacao.valida) {
      Alert.alert("Erro", validacao.mensagem);
      return;
    }

    if (login.trim().length === 0 || senha.trim().length === 0) {
      Alert.alert("Erro", "Login e senha não podem conter apenas espaços");
      return;
    }

    if (!isMountedRef.current) return;
    setLoading(true);

    try {
      const normalizedUrl = normalizeServerUrl(serverUrl);

      console.log("Tentando login em:", normalizedUrl);

      const response = await authService.login(
        normalizedUrl,
        login.trim(),
        senha,
      );

      if (!isMountedRef.current) {
        setLoading(false);
        return;
      }

      if (!response || typeof response !== "object") {
        throw new Error("Resposta inválida do servidor");
      }

      if (
        !response.token ||
        !response.id ||
        !response.nome ||
        !response.perfil
      ) {
        throw new Error(
          "Dados de autenticação incompletos recebidos do servidor",
        );
      }

      console.log("Login bem-sucedido. Perfil:", response.perfil);

      if (response.perfil !== "entregador") {
        Alert.alert(
          "Acesso Negado",
          "Apenas usuários com perfil de entregador podem usar este aplicativo",
        );
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      await authService.saveAuthData(normalizedUrl, response, {
        login: login.trim(),
        senha,
      });

      // Proteger inicialização de rastreamento
      try {
        await garantirRastreamentoAtivo();
      } catch (trackingError) {
        console.error("Erro ao iniciar rastreamento:", trackingError);
        // Não bloqueia o login se o rastreamento falhar
      }

      console.log("Configuração concluída com sucesso");

      if (isMountedRef.current) {
        onConfigComplete();
      }
    } catch (error: any) {
      console.error("Erro ao configurar:", error);

      if (!isMountedRef.current) {
        setLoading(false);
        return;
      }

      let errorMessage = "Erro ao conectar com o servidor";

      if (error.response?.status === 401) {
        errorMessage = "Login ou senha inválidos";
      } else if (error.response?.status === 404) {
        errorMessage =
          "Endpoint de login não encontrado. Verifique o endereço do servidor.";
      } else if (error.response?.status === 500) {
        errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
      } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        errorMessage = "Tempo de conexão esgotado. Verifique sua internet.";
      } else if (
        error.message?.includes("Network Error") ||
        error.code === "ERR_NETWORK"
      ) {
        errorMessage = "Erro de rede. Verifique sua conexão.";
      } else if (error.message?.includes("ENOTFOUND")) {
        errorMessage = "Servidor não encontrado. Verifique o endereço.";
      } else if (
        error.message === "Resposta inválida do servidor" ||
        error.message ===
          "Dados de autenticação incompletos recebidos do servidor"
      ) {
        errorMessage = error.message;
      }

      Alert.alert("Erro", errorMessage);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <LinearGradient
      colors={["#1565c0", "#1976d2", "#42a5f5"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoShadow}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.appTitleContainer}>
            <Text style={styles.appTitle}>GestGAS</Text>
            <View style={styles.appTitleShadow}>
              <Text style={styles.appTitleOutline}>GestGAS</Text>
            </View>
          </View>
          <Text style={styles.appSubtitle}>Sistema de Entregas</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Insira seus dados</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Endereço web da empresa</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="globe-outline"
                size={20}
                color="#1976d2"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Ex.: nomedaempresa.cotrium.com ou 192.168.1.100:3000"
                placeholderTextColor="#999"
                value={serverUrl}
                onChangeText={(text) => setServerUrl(text.trim())}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!loading}
                returnKeyType="next"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.testButton,
                (testingConnection || !serverUrl) && styles.buttonDisabled,
              ]}
              onPress={testConnection}
              disabled={testingConnection || !serverUrl}
              activeOpacity={0.8}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.testButtonText}>Testar Conexão</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Login</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#1976d2"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Digite seu login"
                placeholderTextColor="#999"
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#1976d2"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor="#999"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (loading || !serverUrl || !login || !senha) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !serverUrl || !login || !senha}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={
                loading || !serverUrl || !login || !senha
                  ? ["#ccc", "#999"]
                  : ["#0d47a1", "#1565c0", "#1976d2"]
              }
              style={styles.submitButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Entrar</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Acesso exclusivo para entregadores
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 8,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appTitleContainer: {
    position: "relative",
    marginTop: 20,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 2,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
    zIndex: 2,
  },
  appTitleShadow: {
    position: "absolute",
    top: 3,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  appTitleOutline: {
    fontSize: 38,
    fontWeight: "bold",
    color: "rgba(0, 0, 0, 0.2)",
    letterSpacing: 2,
    textAlign: "center",
  },
  appSubtitle: {
    fontSize: 16,
    color: "#e3f2fd",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: "#ffffffff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  formHeader: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#bbdefb",
    alignItems: "center",
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 6,
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 14,
    color: "#1976d2",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#bbdefb",
    paddingLeft: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 14,
    paddingLeft: 0,
    fontSize: 16,
    color: "#333",
  },
  testButton: {
    backgroundColor: "#42a5f5",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    alignItems: "center",
    shadowColor: "#42a5f5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#0d47a1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  submitButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  footer: {
    marginTop: 30,
    alignItems: "center",
  },
  footerText: {
    color: "#e3f2fd",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
