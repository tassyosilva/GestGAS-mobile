import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import axios from "axios";
import { storageService } from "./storageService";

const LOCATION_TASK_NAME = "background-location-task";
const LOCATION_INTERVAL = 20 * 1000; // localização a cada 20 segundos

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Erro ao capturar localização em background:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      try {
        const user = await storageService.getUser();

        if (user && user.id) {
          await enviarLocalizacao(
            user.id,
            location.coords.latitude,
            location.coords.longitude,
          );
        }
      } catch (err) {
        console.error("Erro ao processar localização:", err);
      }
    }
  }
});

async function enviarLocalizacao(
  entregadorId: number,
  latitude: number,
  longitude: number,
) {
  try {
    const timestamp = new Date().toISOString();
    const serverUrl = await storageService.getServerUrl();
    const token = await storageService.getToken();

    if (!serverUrl || !token) {
      console.log("Servidor ou token não configurado");
      return;
    }

    await axios.post(
      `${serverUrl}/api/entregadores/localizacao`,
      {
        entregador_id: entregadorId,
        latitude: latitude,
        longitude: longitude,
        timestamp: timestamp,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Localização enviada com sucesso:", { latitude, longitude });
  } catch (error) {
    console.error("Erro ao enviar localização:", error);
  }
}

export async function solicitarPermissoes(): Promise<boolean> {
  try {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      console.log("Permissão de localização negada");
      return false;
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      console.log("Permissão de localização em background negada");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao solicitar permissões:", error);
    return false;
  }
}

export async function iniciarRastreamento(): Promise<boolean> {
  try {
    const permissaoOk = await solicitarPermissoes();

    if (!permissaoOk) {
      console.log("Permissões não concedidas");
      return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL,
      distanceInterval: 0,
      // Melhorias para dispositivos Xiaomi e Android em geral
      deferredUpdatesInterval: LOCATION_INTERVAL, // Sincroniza com timeInterval
      pausesUpdatesAutomatically: false, // Mantém rastreamento mesmo quando parado
      showsBackgroundLocationIndicator: true, // Ícone na barra de status (Android 10+)
      foregroundService: {
        notificationTitle: "Rastreamento Ativo",
        notificationBody: "Sua localização está sendo compartilhada",
        notificationColor: "#1976d2",
      },
    });

    console.log("Rastreamento iniciado com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao iniciar rastreamento:", error);
    return false;
  }
}

export async function pararRastreamento(): Promise<void> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log("Rastreamento parado");
    }
  } catch (error) {
    console.error("Erro ao parar rastreamento:", error);
  }
}
