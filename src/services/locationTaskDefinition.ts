import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import axios from "axios";
import { storageService } from "./storageService";

export const LOCATION_TASK_NAME = "background-location-task";

// Define a task de localização em background
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
