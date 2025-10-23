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
  Animated, // Importa a API de Animação
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { authService } from "../services/authService";
import { pedidosService } from "../services/pedidoService";
import { Pedido, Usuario, PedidoResolvido } from "../types";
import PedidoCard from "../components/PedidoCard";
import { calcularTempoEntrega, formatShortDate } from "../utils/formatters";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  navigation: any;
  onLogout: () => void;
}

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
  const limit = 20;
  const limitFinalizados = 10;

  // --- Animação ---
  // Valor da animação (de 0 para 1)
  const panelAnim = useRef(new Animated.Value(0)).current;
  // Estado para controlar a renderização (para animar a saída)
  const [isPanelRendered, setIsPanelRendered] = useState(false);

  // Efeito para disparar a animação
  useEffect(() => {
    if (showFinalizados) {
      // 1. Monta o componente
      setIsPanelRendered(true);
      // 2. Anima a entrada (subida)
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 350, // Duração mais suave
        useNativeDriver: false, // height e opacity não usam o driver nativo
      }).start();
    } else {
      // 1. Anima a saída (descida)
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        // 2. Desmonta o componente APÓS a animação
        setIsPanelRendered(false);
      });
    }
  }, [showFinalizados, panelAnim]);

  // Estilos que serão animados
  const panelAnimatedStyle = {
    height: panelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "60%"], // Anima a altura
    }),
    opacity: panelAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.7, 1], // Faz o fade in junto
    }),
  };
  // --- Fim Animação ---

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

  const loadPedidos = useCallback(async () => {
    if (!user) return;
    try {
      if (page === 0) setLoading(true);
      const response = await pedidosService.listarPedidosEntregador({
        entregador_id: user.id,
        page: page + 1,
        limit,
      });

      if (response && response.pedidos && Array.isArray(response.pedidos)) {
        // Filtrar pedidos válidos
        const pedidosValidos = response.pedidos.filter(
          (p: any) => p && p.id && p.cliente,
        );
        setPedidos(pedidosValidos);
        setTotal(typeof response.total === "number" ? response.total : 0);
      } else {
        setPedidos([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error("Erro ao carregar entregas:", error);
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, page, onLogout]);

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
          .filter((p: any) => p && p.id) // Filtrar pedidos nulos ou sem ID
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

        if (pageFinalizados === 0) {
          setPedidosFinalizados(pedidosResolvidosData);
        } else {
          setPedidosFinalizados((prevPedidos) => [
            ...prevPedidos,
            ...pedidosResolvidosData,
          ]);
        }
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

  useEffect(() => {
    loadUser();
  }, []);

  // ATUALIZADO: Este useEffect agora carrega os dados iniciais
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
    setPageFinalizados(0);
    setPedidosFinalizados([]);

    loadPedidos();
    loadTotalFinalizados();

    if (showFinalizados) {
      loadPedidosFinalizados();
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
    // Apenas alterna o estado de "intenção"
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

  const renderPedidoFinalizadoCard = ({ item }: { item: PedidoResolvido }) => {
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
                {/* ÍCONE COLORIDO (VERMELHO) */}
                <Ionicons name="location-outline" size={16} color="#f44336" />
                <Text style={styles.finalizadoText}>{item.bairro}</Text>
              </View>
            )}
            {item.data_entrega && (
              <View style={styles.finalizadoRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#4caf50" // Cor verde para "Entregue"
                />
                <Text style={[styles.finalizadoText, { color: "#4caf50" }]}>
                  Entregue: {formatShortDate(item.data_entrega)}
                </Text>
              </View>
            )}
            {tempoEntrega && (
              <View style={styles.finalizadoRow}>
                {/* ÍCONE COLORIDO (LARANJA) */}
                <Ionicons name="time-outline" size={16} color="#ff9800" />
                <Text style={styles.finalizadoText}>
                  Tempo de entrega: {tempoEntrega}
                </Text>
              </View>
            )}
            {item.forma_pagamento &&
              typeof item.forma_pagamento === "string" && (
                <View style={styles.finalizadoRow}>
                  {/* ÍCONE COLORIDO (AZUL) */}
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
  };

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

      {/* Cabeçalho com Gradiente */}
      <LinearGradient
        colors={["#1565c0", "#1976d2"]}
        style={[
          styles.header,
          { paddingTop: insets.top + 10 }, // Usa insets para padding seguro
        ]}
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

      {/* Cartão de Estatísticas (Estilo do DetalhesPedidoScreen) */}
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

      {/* Botão de Histórico (Estilo Melhorado) */}
      <TouchableOpacity
        style={styles.historicoButton} // Apenas posicionamento
        onPress={toggleFinalizados}
        // Mede a altura do botão para posicionar o painel
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
              // Adiciona o inset ao padding original
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

      {/* Painel de Histórico (Agora Animado) */}
      {isPanelRendered && (
        <Animated.View
          style={[
            styles.finalizadosContainer,
            // Posiciona dinamicamente acima do botão
            { bottom: historyButtonHeight },
            // Aplica os estilos de animação (height, opacity)
            panelAnimatedStyle,
          ]}
        >
          {/* Cabeçalho do Painel com Gradiente */}
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
    backgroundColor: "#f5f5f5", // Fundo cinza claro
  },
  header: {
    // backgroundColor removido, agora é um gradiente
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // paddingTop é definido dinamicamente com insets
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
    marginTop: -10, // Puxa para cima do header
    marginBottom: 16,
    borderRadius: 12, // Borda arredondada
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    paddingVertical: 16, // Mais preenchimento vertical
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
    fontSize: 11, // Um pouco menor
    fontWeight: "bold",
    color: "#666",
    marginTop: 4,
    textAlign: "center",
    letterSpacing: 0.5, // Mais espaçamento
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Espaço para o botão de histórico
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
    color: "#555", // Cor mais escura
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999", // Cor mais clara
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
    // Estilos de layout movidos para historicoButtonGradient
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
    paddingTop: 16, // Padding ajustado
    paddingBottom: Platform.OS === "android" ? 14 : 14, // Padding base
    gap: 10,
  },
  historicoButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700", // Mais forte
    letterSpacing: 0.3,
  },
  finalizadosContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    // height é controlado pela animação
    // Cantos arredondados como o modal
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Sombra mais suave
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    // 'bottom' é aplicado dinamicamente
    overflow: "hidden", // Garante que a animação de altura funcione
  },
  finalizadosHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    // Cantos arredondados para o gradiente
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  finalizadosTitle: {
    fontSize: 18, // Maior
    fontWeight: "bold", // Mais forte
    color: "#fff", // Cor branca no gradiente
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
    borderRadius: 16, // Mais arredondado
    padding: 18, // Mais preenchimento
    marginBottom: 8,
    marginTop: 8,
    // Sombra do 'section'
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 4, // Borda mais espessa
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
    fontWeight: "bold", // Destaque
    color: "#333",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  finalizadoInfo: {
    gap: 8, // Espaço entre as linhas
  },
  finalizadoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // Espaço entre ícone e texto
  },
  finalizadoText: {
    fontSize: 14, // Maior para legibilidade
    color: "#555", // Cor de texto principal
    flex: 1, // Permite quebra de linha
  },
});
