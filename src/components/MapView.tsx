import React from "react";
import { View, StyleSheet, Text } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
}

export default function MapViewComponent({
  latitude,
  longitude,
  title,
  description,
}: Props) {
  console.log("=== MAPVIEW COMPONENT ===");
  console.log("Latitude:", latitude);
  console.log("Longitude:", longitude);

  // CORREÇÃO: Validar coordenadas
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

  try {
    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onMapReady={() => console.log("Mapa carregado com sucesso")}
          // --- CORREÇÃO ---
          // A propriedade 'onError' foi removida, pois não existe
          // nas props do MapView e estava causando o erro TS2322.
          // O try/catch ao redor já lida com erros de renderização.
          loadingEnabled={true}
          loadingIndicatorColor="#1976d2"
          loadingBackgroundColor="#f0f0f0"
        >
          <Marker
            coordinate={{ latitude, longitude }}
            title={title}
            description={description}
          />
        </MapView>
      </View>
    );
  } catch (error: any) {
    // <-- CORREÇÃO: Adicionado ': any' para tipagem explícita
    console.error("Erro ao renderizar MapView:", error);
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={24} color="#f44336" />
        <Text style={styles.errorText}>
          Erro ao carregar o mapa. Tente novamente.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  map: {
    width: "100%",
    height: "100%",
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
