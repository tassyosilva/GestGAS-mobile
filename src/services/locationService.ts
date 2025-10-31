import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { LOCATION_TASK_NAME } from "./locationTaskDefinition";

const LOCATION_INTERVAL = 20 * 1000; // localização a cada 20 segundos

/**
 * Solicita permissões de localização de forma adequada para Android 10+
 * No Android 10+, é necessário solicitar background location separadamente
 */
export async function solicitarPermissoes(): Promise<boolean> {
  try {
    // 1. Primeiro solicita permissão de foreground
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      console.log("Permissão de localização em foreground negada");
      return false;
    }

    console.log("Permissão de foreground concedida");

    // 2. Depois solicita permissão de background (Android 10+)
    // Em Android 10+, isso pode abrir as configurações do sistema
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      console.log("Permissão de localização em background negada");
      console.log(
        "IMPORTANTE: No Android, você pode precisar ir em Configurações > Apps > GestGAS > Permissões > Localização e selecionar 'Permitir o tempo todo'",
      );
      return false;
    }

    console.log("Permissão de background concedida");
    return true;
  } catch (error) {
    console.error("Erro ao solicitar permissões:", error);
    return false;
  }
}

/**
 * Verifica se o rastreamento está ativo
 */
export async function isRastreamentoAtivo(): Promise<boolean> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    console.log("Rastreamento ativo?", isRegistered);
    return isRegistered;
  } catch (error) {
    console.error("Erro ao verificar se rastreamento está ativo:", error);
    return false;
  }
}

/**
 * Verifica o status atual das permissões de localização
 */
export async function verificarPermissoes(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: foreground.status === "granted",
      background: background.status === "granted",
    };
  } catch (error) {
    console.error("Erro ao verificar permissões:", error);
    return { foreground: false, background: false };
  }
}

/**
 * Inicia o rastreamento de localização em background
 * Inclui verificações para evitar duplicação e melhorias para Android
 */
export async function iniciarRastreamento(): Promise<boolean> {
  try {
    console.log("=== Iniciando rastreamento de localização ===");

    // 1. Verifica se já está rodando
    const jaRodando = await isRastreamentoAtivo();
    if (jaRodando) {
      console.log("Rastreamento já está ativo, pulando inicialização");
      return true;
    }

    // 2. Verifica permissões
    const permissoes = await verificarPermissoes();
    console.log("Status de permissões:", permissoes);

    if (!permissoes.foreground || !permissoes.background) {
      console.log("Permissões insuficientes, solicitando...");
      const permissaoOk = await solicitarPermissoes();

      if (!permissaoOk) {
        console.log("Permissões não concedidas");
        return false;
      }
    }

    // 3. Inicia o rastreamento
    console.log("Iniciando Location.startLocationUpdatesAsync...");

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL,
      distanceInterval: 0,
      deferredUpdatesInterval: LOCATION_INTERVAL,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true, // Mostra ícone na barra de status (Android 10+)
      foregroundService: {
        notificationTitle: "Rastreamento Ativo",
        notificationBody: "Sua localização está sendo compartilhada",
        notificationColor: "#1976d2",
        // Android 12+ requer killServiceOnDestroy false para manter serviço ativo
        ...(Platform.OS === "android" && { killServiceOnDestroy: false }),
      },
    });

    console.log("Rastreamento iniciado com sucesso!");
    return true;
  } catch (error) {
    console.error("Erro ao iniciar rastreamento:", error);
    return false;
  }
}

/**
 * Para o rastreamento de localização em background
 */
export async function pararRastreamento(): Promise<void> {
  try {
    console.log("=== Parando rastreamento de localização ===");

    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log("Rastreamento parado com sucesso");
    } else {
      console.log("Rastreamento não estava ativo");
    }
  } catch (error) {
    console.error("Erro ao parar rastreamento:", error);
  }
}

/**
 * Garante que o rastreamento está ativo
 * Útil para chamar quando o app volta do background ou é reaberto
 */
export async function garantirRastreamentoAtivo(): Promise<boolean> {
  try {
    const jaAtivo = await isRastreamentoAtivo();

    if (jaAtivo) {
      console.log("Rastreamento já está ativo");
      return true;
    }

    console.log("Rastreamento não está ativo, tentando reiniciar...");
    return await iniciarRastreamento();
  } catch (error) {
    console.error("Erro ao garantir rastreamento ativo:", error);
    return false;
  }
}
