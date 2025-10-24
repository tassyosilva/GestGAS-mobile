import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { authService } from "../services/authService";
import { pedidosService } from "../services/pedidoService";
import { notificationService } from "../services/notificationService";
import { Pedido, Usuario, PedidoResolvido } from "../types";
import PedidoCard from "../components/PedidoCard";
import { calcularTempoEntrega, formatShortDate } from "../utils/formatters";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  navigation: any;
  onLogout: () => void;
}

const POLLING_INTERVAL = 5000; // 5 segundos

export default function MinhasEntregasScreen({ navigation, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosFinalizados, setPedidosFinalizados] = useState<
    PedidoResolvido[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingFinalizados, setLoadingFinalizados] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [pageFinalizados, setPageFinalizados] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalFinalizados, setTotalFinalizados] = useState(0);
  const [user, setUser] = useState<Usuario | null>(null);
  const [showFinalizados, setShowFinalizados] = useState(false);
  const [historyButtonHeight, setHistoryButtonHeight] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const pedidosIdsAnteriores = useRef<Set<number>>(new Set());

  const panelAnim = useRef(new Animated.Value(0)).current;
  const [isPanelRendered, setIsPanelRendered] = useState(false);

  const limit = 20;
  const limitFinalizados = 10;

  const loadTotalFinalizados = useCallback(async () => {
    if (!user) return;
    try {
      const response = await pedidosService.listarPedidosFinalizados({
        entregador_id: user.id,
        page: 1,
        limit: 1,
      });
      if (response && typeof response.total === "number") {
        setTotalFinalizados(response.total);
      } else {
        setTotalFinalizados(0);
      }
    } catch (_error) {
      console.error("Erro ao carregar total de finalizados:", _error);
      setTotalFinalizados(0);
    }
  }, [user]);

  const loadPedidos = useCallback(
    async (isPolling = false) => {
      if (!user) return;
      try {
        if (page === 0 && !isPolling) setLoading(true);

        const response = await pedidosService.listarPedidosEntregador({
          entregador_id: user.id,
          page: page + 1,
          limit,
        });

        if (response && response.pedidos && Array.isArray(response.pedidos)) {
          const pedidosValidos = response.pedidos.filter(
            (p: any) => p && p.id && p.cliente,
          );

          if (isPolling && pedidosValidos.length > 0) {
            const idsAtuais = new Set(pedidosValidos.map((p: any) => p.id));
            const novosIds = Array.from(idsAtuais).filter(
              (id) => !pedidosIdsAnteriores.current.has(id),
            );

            if (novosIds.length > 0) {
              console.log(`${novosIds.length} novo(s) pedido(s) detectado(s)`);
              await notificationService.enviarNotificacaoNovosPedidos(
                novosIds.length,
              );
            }

            pedidosIdsAnteriores.current = idsAtuais;
          } else if (!isPolling) {
            pedidosIdsAnteriores.current = new Set(
              pedidosValidos.map((p: any) => p.id),
            );
          }

          setPedidos(pedidosValidos);
          setTotal(typeof response.total === "number" ? response.total : 0);
        } else {
          setPedidos([]);
          setTotal(0);
        }
      } catch (error: any) {
        console.error("Erro ao carregar entregas:", error);

        if (!isPolling) {
          setPedidos([]);
          setTotal(0);

          let errorMessage = "Erro ao carregar entregas";
          if (
            error.response?.status === 401 ||
            error.message === "Sessão expirada"
          ) {
            errorMessage = "Sessão expirada. Faça login novamente.";
            await authService.logout();
            onLogout();
          } else if (error.message.includes("Network Error")) {
            errorMessage = "Erro de conexão. Verifique sua internet.";
          }
          Alert.alert("Erro", errorMessage);
        }
      } finally {
        if (!isPolling) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [user, page, onLogout],
  );

  const loadPedidosFinalizados = useCallback(async () => {
    if (!user || loadingFinalizados) return;
    try {
      setLoadingFinalizados(true);
      const response = await pedidosService.listarPedidosFinalizados({
        entregador_id: user.id,
        page: pageFinalizados + 1,
        limit: limitFinalizados,
      });

      if (response && response.pedidos && Array.isArray(response.pedidos)) {
        const pedidosResolvidosData = response.pedidos
          .filter((p: any) => p && p.id)
          .map((p: any) => ({
            id: p.id,
            data_entregador_atribuido: p.data_entregador_atribuido || null,
            data_entrega: p.data_entrega || null,
            endereco_entrega: p.endereco_entrega || "",
            valor_total: p.valor_total || 0,
            cliente_nome: p.cliente?.nome || p.cliente_nome || "Cliente",
            status: p.status || "desconhecido",
            bairro: p.bairro || null,
            forma_pagamento: p.forma_pagamento || null,
          }));

        setPedidosFinalizados((prevPedidos) => {
          if (pageFinalizados === 0) {
            return pedidosResolvidosData;
          } else {
            const prevIds = new Set(prevPedidos.map((p) => p.id));
            const novos = pedidosResolvidosData.filter(
              (p) => !prevIds.has(p.id),
            );
            return [...prevPedidos, ...novos];
          }
        });

        setTotalFinalizados(
          typeof response.total === "number" ? response.total : 0,
        );
      } else if (pageFinalizados === 0) {
        setPedidosFinalizados([]);
        setTotalFinalizados(0);
      }
    } catch (_error: any) {
      console.error("Erro ao carregar pedidos finalizados:", _error);
      if (pageFinalizados === 0) {
        setPedidosFinalizados([]);
        setTotalFinalizados(0);
      }
    } finally {
      setLoadingFinalizados(false);
    }
  }, [user, loadingFinalizados, pageFinalizados, limitFinalizados]);

  const iniciarPolling = useCallback(() => {
    console.log("Iniciando polling...");

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      console.log("Executando polling...");
      loadPedidos(true);
    }, POLLING_INTERVAL);
  }, [loadPedidos]);

  const pararPolling = useCallback(() => {
    console.log("Parando polling...");
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("App voltou para foreground - recarregando dados");
        loadPedidos(false);
        loadTotalFinalizados();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadPedidos, loadTotalFinalizados]);

  useFocusEffect(
    useCallback(() => {
      console.log("Tela MinhasEntregas recebeu foco");

      if (user) {
        loadPedidos(false);
        loadTotalFinalizados();
      }

      notificationService.limparBadge();

      iniciarPolling();

      return () => {
        console.log("Tela MinhasEntregas perdeu foco");
        pararPolling();
      };
    }, [user, loadPedidos, loadTotalFinalizados, iniciarPolling, pararPolling]),
  );

  useEffect(() => {
    const solicitarPermissoesNotificacao = async () => {
      await notificationService.solicitarPermissoes();
    };

    solicitarPermissoesNotificacao();
  }, []);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadPedidos();
      loadTotalFinalizados();
    }
  }, [user, page, loadPedidos, loadTotalFinalizados]);

  useEffect(() => {
    if (user && pageFinalizados > 0) {
      loadPedidosFinalizados();
    }
  }, [user, pageFinalizados, loadPedidosFinalizados]);

  useEffect(() => {
    if (showFinalizados) {
      setIsPanelRendered(true);
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setIsPanelRendered(false);
      });
    }
  }, [showFinalizados, panelAnim]);

  const panelAnimatedStyle = {
    height: panelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "60%"],
    }),
    opacity: panelAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.7, 1],
    }),
  };

  const loadUser = async () => {
    try {
      const userData = await authService.getUser();
      setUser(userData);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      Alert.alert("Erro", "Não foi possível carregar dados do usuário");
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);

    loadPedidos();
    loadTotalFinalizados();

    if (showFinalizados) {
      setPageFinalizados(0);
      setPedidosFinalizados([]);
      setTimeout(() => {
        loadPedidosFinalizados();
      }, 100);
    }
  }, [
    showFinalizados,
    loadPedidos,
    loadTotalFinalizados,
    loadPedidosFinalizados,
  ]);

  const handlePedidoPress = (pedido: Pedido) => {
    navigation.navigate("DetalhesPedido", { pedidoId: pedido.id });
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            pararPolling();
            await notificationService.cancelarTodasNotificacoes();
            await authService.logout();
            onLogout();
          } catch (error) {
            console.error("Erro ao fazer logout:", error);
            Alert.alert("Erro", "Não foi possível fazer logout");
          }
        },
      },
    ]);
  };

  const handleLoadMoreFinalizados = () => {
    if (pedidosFinalizados.length < totalFinalizados && !loadingFinalizados) {
      setPageFinalizados((prev) => prev + 1);
    }
  };

  const toggleFinalizados = () => {
    const newState = !showFinalizados;
    setShowFinalizados(newState);
    if (newState && pedidosFinalizados.length === 0) {
      if (pageFinalizados !== 0) {
        setPageFinalizados(0);
      }
      loadPedidosFinalizados();
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="file-tray-outline" size={80} color="#ccc" />
      <Text style={styles.emptyText}>Nenhuma entrega pendente</Text>
      <Text style={styles.emptySubtext}>
        Seus pedidos aparecerão aqui quando forem atribuídos a você
      </Text>
    </View>
  );

  const renderPedidoFinalizadoCard = useCallback(
    ({ item }: { item: PedidoResolvido }) => {
      if (!item || !item.id) return null;

      try {
        const tempoEntrega =
          item.data_entregador_atribuido && item.data_entrega
            ? calcularTempoEntrega(
                item.data_entregador_atribuido,
                item.data_entrega,
              )
            : null;

        return (
          <View style={styles.finalizadoCard}>
            <View style={styles.finalizadoHeader}>
              <Text style={styles.finalizadoId}>Pedido #{item.id}</Text>
              <Text style={styles.finalizadoCliente}>
                {item.cliente_nome || "Cliente"}
              </Text>
            </View>
            <View style={styles.finalizadoInfo}>
              {item.bairro && typeof item.bairro === "string" && (
                <View style={styles.finalizadoRow}>
                  <Ionicons name="location-outline" size={16} color="#f44336" />
                  <Text style={styles.finalizadoText}>{item.bairro}</Text>
                </View>
              )}
              {item.data_entrega && (
                <View style={styles.finalizadoRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#4caf50"
                  />
                  <Text
                    style={[styles.finalizadoText, styles.finalizadoTextGreen]}
                  >
                    Entregue: {formatShortDate(item.data_entrega)}
                  </Text>
                </View>
              )}
              {tempoEntrega && (
                <View style={styles.finalizadoRow}>
                  <Ionicons name="time-outline" size={16} color="#ff9800" />
                  <Text style={styles.finalizadoText}>
                    Tempo de entrega: {tempoEntrega}
                  </Text>
                </View>
              )}
              {item.forma_pagamento &&
                typeof item.forma_pagamento === "string" && (
                  <View style={styles.finalizadoRow}>
                    <Ionicons name="card-outline" size={16} color="#1976d2" />
                    <Text style={styles.finalizadoText}>
                      {item.forma_pagamento}
                    </Text>
                  </View>
                )}
            </View>
          </View>
        );
      } catch (error) {
        console.error("Erro ao renderizar pedido finalizado:", error);
        return null;
      }
    },
    [],
  );

  const renderFooter = () => {
    if (!loading || pedidos.length === 0) return null;
    return <ActivityIndicator style={styles.loadingFooter} color="#1976d2" />;
  };

  const renderFooterFinalizados = () => {
    if (!loadingFinalizados) return null;
    return <ActivityIndicator style={styles.loadingFooter} color="#1976d2" />;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={["#1565c0", "#1976d2"]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View>
          <Text style={styles.headerTitle}>Minhas Entregas</Text>
          {user && <Text style={styles.headerSubtitle}>{user.nome}</Text>}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>ENTREGAS ATIVAS</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxLast]}>
          <Text style={styles.statValue}>{totalFinalizados}</Text>
          <Text style={styles.statLabel}>ENTREGAS FINALIZADAS</Text>
        </View>
      </View>

      <FlatList
        data={pedidos}
        keyExtractor={(item, index) =>
          item?.id ? item.id.toString() : `pedido-${index}`
        }
        renderItem={({ item }) => {
          if (!item || !item.id || !item.cliente) return null;
          return (
            <PedidoCard pedido={item} onPress={() => handlePedidoPress(item)} />
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={loading ? null : renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1976d2"]}
            tintColor="#1976d2"
          />
        }
      />

      <TouchableOpacity
        style={styles.historicoButton}
        onPress={toggleFinalizados}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          if (height > 0 && height !== historyButtonHeight) {
            setHistoryButtonHeight(height);
          }
        }}
      >
        <LinearGradient
          colors={["#1565c0", "#1976d2", "#42a5f5"]}
          style={[
            styles.historicoButtonGradient,
            {
              paddingBottom:
                styles.historicoButtonGradient.paddingBottom + insets.bottom,
            },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons
            name={showFinalizados ? "chevron-down" : "chevron-up"}
            size={24}
            color="#fff"
          />
          <Text style={styles.historicoButtonText}>
            {showFinalizados ? "Ocultar" : "Ver"} Histórico ({totalFinalizados})
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {isPanelRendered && (
        <Animated.View
          style={[
            styles.finalizadosContainer,
            { bottom: historyButtonHeight },
            panelAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={["#1565c0", "#1976d2"]}
            style={styles.finalizadosHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="checkmark-done" size={24} color="#fff" />
            <Text style={styles.finalizadosTitle}>Histórico de Entregas</Text>
          </LinearGradient>

          {loadingFinalizados && pedidosFinalizados.length === 0 ? (
            <ActivityIndicator
              style={styles.loadingContainer}
              color="#1976d2"
              size="large"
            />
          ) : pedidosFinalizados.length === 0 ? (
            <View style={styles.emptyFinalizadosContainer}>
              <Text style={styles.emptyFinalizadosText}>
                Nenhuma entrega finalizada ainda
              </Text>
            </View>
          ) : (
            <FlatList
              data={pedidosFinalizados}
              keyExtractor={(item) => `finalizado-${item.id}`}
              renderItem={renderPedidoFinalizadoCard}
              contentContainerStyle={styles.finalizadosListContent}
              ListFooterComponent={renderFooterFinalizados}
              onEndReached={handleLoadMoreFinalizados}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={true}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#e3f2fd",
    marginTop: 4,
    fontWeight: "500",
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -10,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#f0f0f0",
  },
  statBoxLast: {
    borderRightWidth: 0,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1976d2",
    lineHeight: 34,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#666",
    marginTop: 4,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: "center",
  },
  historicoButton: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  historicoButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 14 : 14,
    gap: 10,
  },
  historicoButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  finalizadosContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  finalizadosHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  finalizadosTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  finalizadosListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyFinalizadosContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyFinalizadosText: {
    fontSize: 15,
    color: "#999",
  },
  finalizadoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#4caf50",
  },
  finalizadoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  finalizadoId: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1976d2",
  },
  finalizadoCliente: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  finalizadoInfo: {
    gap: 8,
  },
  finalizadoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  finalizadoText: {
    fontSize: 14,
    color: "#555",
    flex: 1,
  },
  finalizadoTextGreen: {
    color: "#4caf50",
  },
});
