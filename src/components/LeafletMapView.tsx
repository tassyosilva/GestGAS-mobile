import React, { useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
}

export default function LeafletMapView({
  latitude,
  longitude,
  title,
  description,
}: Props) {
  const webViewRef = useRef<WebView>(null);

  console.log("=== LEAFLET MAP ===");
  console.log("Latitude:", latitude);
  console.log("Longitude:", longitude);

  // Validar coordenadas
  const isValidCoordinate = (lat: number, lon: number): boolean => {
    return (
      !isNaN(lat) &&
      !isNaN(lon) &&
      isFinite(lat) &&
      isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  };

  if (!isValidCoordinate(latitude, longitude)) {
    console.error("Coordenadas inválidas:", { latitude, longitude });
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={24} color="#f44336" />
        <Text style={styles.errorText}>
          Não foi possível exibir o mapa. Coordenadas inválidas.
        </Text>
      </View>
    );
  }

  // HTML com Leaflet
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body {
          margin: 0;
          padding: 0;
        }
        #map {
          width: 100%;
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        try {
          // Inicializar mapa
          const map = L.map('map', {
            zoomControl: true,
            attributionControl: true
          }).setView([${latitude}, ${longitude}], 15);

          // Adicionar tile layer do OpenStreetMap
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(map);

          // Adicionar marcador
          const marker = L.marker([${latitude}, ${longitude}]).addTo(map);
          
          ${
            title || description
              ? `
          marker.bindPopup(\`
            ${title ? `<strong>${title.replace(/`/g, "\\`")}</strong><br>` : ""}
            ${description ? description.replace(/`/g, "\\`") : ""}
          \`).openPopup();
          `
              : ""
          }

          console.log('Mapa carregado com sucesso');
        } catch (error) {
          console.error('Erro ao carregar mapa:', error);
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: error.message }));
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("Erro no WebView:", nativeEvent);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.error) {
              console.error("Erro do Leaflet:", data.error);
            }
          } catch (error) {
            console.error("Erro ao processar mensagem:", error);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    height: 250,
    borderRadius: 12,
    backgroundColor: "#ffebee",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: "#f44336",
    textAlign: "center",
  },
});
