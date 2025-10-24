import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private lastNotificationTime = 0;
  private readonly MIN_NOTIFICATION_INTERVAL = 5000; // 5 segundos entre notificações

  async solicitarPermissoes(): Promise<boolean> {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Permissão de notificação negada");
        return false;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Notificações de Entregas",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
          enableVibrate: true,
          enableLights: true,
          lightColor: "#1976d2",
        });
      }

      return true;
    } catch (error) {
      console.error("Erro ao solicitar permissões de notificação:", error);
      return false;
    }
  }

  async enviarNotificacaoNovosPedidos(quantidade: number): Promise<void> {
    try {
      const now = Date.now();
      if (now - this.lastNotificationTime < this.MIN_NOTIFICATION_INTERVAL) {
        console.log("Notificação ignorada - intervalo mínimo não atingido");
        return;
      }

      const permissaoOk = await this.solicitarPermissoes();
      if (!permissaoOk) {
        console.log("Sem permissão para enviar notificações");
        return;
      }

      const titulo =
        quantidade === 1
          ? "Nova Entrega Atribuída!"
          : `${quantidade} Novas Entregas!`;

      const corpo =
        quantidade === 1
          ? "Você tem uma nova entrega para realizar"
          : `Você tem ${quantidade} novas entregas para realizar`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: titulo,
          body: corpo,
          sound: "default",
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { tipo: "novos_pedidos", quantidade },
        },
        trigger: null, // Notificação imediata
      });

      this.lastNotificationTime = now;

      await Notifications.setBadgeCountAsync(quantidade);

      console.log(`Notificação enviada: ${quantidade} novo(s) pedido(s)`);
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
    }
  }

  async limparBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error("Erro ao limpar badge:", error);
    }
  }

  async cancelarTodasNotificacoes(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await this.limparBadge();
    } catch (error) {
      console.error("Erro ao cancelar notificações:", error);
    }
  }
}

export const notificationService = new NotificationService();
