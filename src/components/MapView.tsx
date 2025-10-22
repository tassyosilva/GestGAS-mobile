import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

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
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={title}
          description={description}
        />
      </MapView>
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
  map: {
    width: "100%",
    height: "100%",
  },
});
