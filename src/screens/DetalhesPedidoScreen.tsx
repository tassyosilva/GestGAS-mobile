import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { pedidosService } from "../services/pedidoService";
import { geocodingService } from "../services/geocodingService";
import { PedidoDetalhes, ItemPedido } from "../types";
import {
  formatCurrency,
  formatDate,
  calcularTempoEspera,
} from "../utils/formatters";
import MapViewComponent from "../components/MapView";
import * as Linking from "expo-linking";
import { gruposService } from "../services/gruposService";

interface Props {
  route: any;
  navigation: any;
}

const AnimatedStatusBadge = ({
  status,
  pulseAnim,
  checkAnim,
}: {
  status: string;
  pulseAnim: Animated.Value;
  checkAnim: Animated.Value;
}) => {
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      em_entrega: "#2196f3",
      entregue: "#4caf50",
      pendente: "#ff9800",
      cancelado: "#f44336",
    };
    return colors[status] || "#999";
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      em_entrega: "Em Entrega",
      entregue: "Entregue",
      pendente: "Pendente",
      cancelado: "Cancelado",
    };
    return labels[status] || status;
  };

  const renderIcon = () => {
    if (status === "em_entrega") {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons
            name="bicycle"
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
        </Animated.View>
      );
    } else if (status === "entregue") {
      const rotateInterpolate = checkAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      });

      return (
        <Animated.View
          style={{
            transform: [{ scale: checkAnim }, { rotate: rotateInterpolate }],
            marginRight: 6,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
        </Animated.View>
      );
    }
    return null;
  };

  return (
    <LinearGradient
      colors={[getStatusColor(status), getStatusColor(status) + "dd"]}
      style={styles.statusBadge}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {renderIcon()}
        <Text style={styles.statusText}>{getStatusLabel(status)}</Text>
      </View>
    </LinearGradient>
  );
};

export default function DetalhesPedidoScreen({ route, navigation }: Props) {
  const { pedidoId } = route.params;

  const [pedido, setPedido] = useState<PedidoDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [cascoDialogOpen, setCascoDialogOpen] = useState(false);
  const [cascosDisponiveis, setCascosDisponiveis] = useState<{
    [key: number]: any[];
  }>({});
  const [quantidadesPorCasco, setQuantidadesPorCasco] = useState<{
    [key: number]: { [casco_id: number]: number };
  }>({});
  const [produtosComRetorno, setProdutosComRetorno] = useState<ItemPedido[]>(
    [],
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  const loadPedidoDetalhes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pedidosService.obterPedidoDetalhes(pedidoId);

      if (!data || !data.id) {
        throw new Error("Dados do pedido inválidos");
      }

      if (!data.itens || !Array.isArray(data.itens)) {
        data.itens = [];
      }

      if (!data.cliente) {
        data.cliente = { id: 0, nome: "Cliente não informado", telefone: "" };
      }

      console.log("Pedido carregado:", data);
      setPedido(data);
    } catch (_error: any) {
      console.error("Erro ao carregar detalhes:", _error);
      Alert.alert("Erro", "Não foi possível carregar os detalhes do pedido");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [pedidoId, navigation]);

  useEffect(() => {
    loadPedidoDetalhes();
  }, [loadPedidoDetalhes]);

  useEffect(() => {
    if (
      pedido &&
      pedido.endereco_entrega &&
      typeof pedido.endereco_entrega === "string" &&
      pedido.endereco_entrega.trim().length > 0
    ) {
      geocodeAddress(pedido.endereco_entrega);
    } else if (pedido && !pedido.endereco_entrega) {
      console.log("Pedido sem endereço de entrega");
      setGeocodeError("Endereço de entrega não disponível");
    }
  }, [pedido]);

  useEffect(() => {
    if (pedido) {
      if (pedido.status === "em_entrega") {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      } else if (pedido.status === "entregue") {
        Animated.spring(checkAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [pedido, pulseAnim, checkAnim]);

  const simplificarEnderecoParaNavegacao = (endereco: string): string => {
    let enderecoSimplificado = endereco;

    enderecoSimplificado = enderecoSimplificado.replace(
      /,?\s*CEP\s*:?\s*[\d\-\.]+/gi,
      "",
    );
    enderecoSimplificado = enderecoSimplificado.replace(
      /,\s*(Casa|Apartamento|Apto|Ap|Sala|Loja|Galpão|Sobrado|Bloco|Torre)\b[^,]*/gi,
      "",
    );
    enderecoSimplificado = enderecoSimplificado.replace(
      /,\s*Bairro\s+(Outros\/Não informado|Não informado|Outros|N\/A|S\/N)\b[^,]*/gi,
      "",
    );
    enderecoSimplificado = enderecoSimplificado.replace(
      /,?\s*Bairro\s+/gi,
      ", ",
    );
    enderecoSimplificado = enderecoSimplificado.replace(/\s*,\s*/g, ", ");
    enderecoSimplificado = enderecoSimplificado.replace(/,+/g, ",");
    enderecoSimplificado = enderecoSimplificado.trim().replace(/^,|,$/g, "");

    return enderecoSimplificado;
  };

  const abrirNavegacao = () => {
    if (!pedido) return;

    const enderecoOriginal = pedido.endereco_entrega;
    const endereco = simplificarEnderecoParaNavegacao(enderecoOriginal);

    console.log("Abrindo navegação para:", endereco);

    const enderecoEncoded = encodeURIComponent(endereco);

    const opcoes = [
      {
        nome: "Waze",
        url: `waze://?q=${enderecoEncoded}`,
        webUrl: `https://waze.com/ul?q=${enderecoEncoded}`,
      },
      {
        nome: "Google Maps",
        url: Platform.select({
          ios: `comgooglemaps://?q=${enderecoEncoded}`,
          android: `google.navigation:q=${enderecoEncoded}`,
        }),
        webUrl: `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`,
      },
    ];

    const tentarAbrir = async () => {
      const wazeUrl = opcoes[0].url;
      if (wazeUrl) {
        try {
          const wazeSupported = await Linking.canOpenURL(wazeUrl);
          if (wazeSupported) {
            await Linking.openURL(wazeUrl);
            return;
          }
        } catch {
          console.log("Waze não disponível, tentando próximo...");
        }
      }

      const googleMapsUrl = opcoes[1].url;
      if (googleMapsUrl) {
        try {
          const googleMapsSupported = await Linking.canOpenURL(googleMapsUrl);
          if (googleMapsSupported) {
            await Linking.openURL(googleMapsUrl);
            return;
          }
        } catch {
          console.log("Google Maps app não disponível, tentando web...");
        }
      }

      try {
        await Linking.openURL(opcoes[1].webUrl);
      } catch {
        console.error("Erro ao abrir qualquer opção:");
        Alert.alert("Erro", "Não foi possível abrir o aplicativo de navegação");
      }
    };

    tentarAbrir();
  };

  const geocodeAddress = async (address: string) => {
    try {
      setGeocoding(true);
      setGeocodeError(null);
      const coords = await geocodingService.geocodeAddress(address);
      if (coords) {
        setLocation(coords);
      } else {
        setGeocodeError(
          "Mapa indisponível para este endereço. Abra a navegação para visualizar.",
        );
      }
    } catch (_error) {
      console.error("Erro capturado no geocodeAddress:", _error);
      setGeocodeError("Erro ao buscar localização");
    } finally {
      setGeocoding(false);
    }
  };

  const handleConfirmarEntrega = async () => {
    if (!pedido) return;

    console.log("Iniciando confirmação de entrega");
    setConfirmingDelivery(true);

    try {
      const produtosRetornaveis = pedido.itens.filter(
        (item) =>
          item.retorna_botija &&
          (item.categoria === "botija_gas" || item.categoria === "agua"),
      );

      console.log("Produtos retornáveis:", produtosRetornaveis);

      if (produtosRetornaveis.length === 0) {
        await confirmarSemCascos();
        return;
      }

      const cascosMap =
        await gruposService.buscarCascosDisponiveis(produtosRetornaveis);
      console.log("Cascos disponíveis:", cascosMap);

      let todosTemUmCasco = true;
      const cascosAutomaticos: {
        [key: string]: Array<{ casco_id: number; quantidade: number }>;
      } = {};

      for (const produto of produtosRetornaveis) {
        if (!produto.produto_id) continue;

        const cascosDesteProduto = cascosMap[produto.produto_id] || [];

        if (cascosDesteProduto.length === 0) {
          console.log(`Produto ${produto.nome_produto} sem cascos disponíveis`);
          todosTemUmCasco = false;
          break;
        } else if (cascosDesteProduto.length === 1) {
          cascosAutomaticos[produto.produto_id.toString()] = [
            {
              casco_id: cascosDesteProduto[0].id,
              quantidade: produto.quantidade || 0,
            },
          ];
          console.log(
            `Produto ${produto.nome_produto} tem apenas 1 casco - seleção automática`,
          );
        } else {
          console.log(
            `Produto ${produto.nome_produto} tem ${cascosDesteProduto.length} cascos - requer seleção manual`,
          );
          todosTemUmCasco = false;
          break;
        }
      }

      if (
        todosTemUmCasco &&
        Object.keys(cascosAutomaticos).length === produtosRetornaveis.length
      ) {
        console.log(
          "Confirmando automaticamente com cascos:",
          cascosAutomaticos,
        );
        await confirmarComCascos(cascosAutomaticos);
      } else {
        console.log("Abrindo modal para seleção manual");
        setProdutosComRetorno(produtosRetornaveis);
        setCascosDisponiveis(cascosMap);

        const quantidadesIniciais: {
          [key: number]: { [casco_id: number]: number };
        } = {};
        for (const produto of produtosRetornaveis) {
          if (produto.produto_id) {
            quantidadesIniciais[produto.produto_id] = {};
            const cascos = cascosMap[produto.produto_id] || [];
            cascos.forEach((casco) => {
              quantidadesIniciais[produto.produto_id!][casco.id] = 0;
            });
          }
        }
        setQuantidadesPorCasco(quantidadesIniciais);

        setConfirmingDelivery(false);
        setCascoDialogOpen(true);
      }
    } catch (error) {
      console.error("Erro ao processar confirmação:", error);
      Alert.alert("Erro", "Erro ao processar confirmação de entrega");
      setConfirmingDelivery(false);
    }
  };

  const confirmarSemCascos = async () => {
    try {
      await pedidosService.confirmarEntrega({
        pedido_id: pedido!.id,
      });

      Alert.alert("Sucesso", "Entrega confirmada com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error("Erro ao confirmar:", error);
      Alert.alert("Erro", error.response?.data || "Erro ao confirmar entrega");
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const confirmarComCascos = async (cascos: {
    [key: string]: Array<{ casco_id: number; quantidade: number }>;
  }) => {
    try {
      await pedidosService.confirmarEntrega({
        pedido_id: pedido!.id,
        cascos: cascos,
      });

      Alert.alert(
        "Sucesso",
        "Entrega confirmada e cascos registrados com sucesso!",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      console.error("Erro ao confirmar com cascos:", error);
      Alert.alert("Erro", error.response?.data || "Erro ao confirmar entrega");
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleIncrementoCasco = (
    produto: ItemPedido,
    cascoId: number,
    delta: number,
  ) => {
    if (!produto.produto_id) return;

    const produtoId = produto.produto_id;
    const quantidadeRequerida = produto.quantidade || 0;

    setQuantidadesPorCasco((prev) => {
      const quantidadesAtuais = { ...prev };
      const quantidadesProdutoAtual = {
        ...(quantidadesAtuais[produtoId] || {}),
      };
      const quantidadeCascoAtual = quantidadesProdutoAtual[cascoId] || 0;

      let totalSelecionadoAtual = 0;
      for (const id in quantidadesProdutoAtual) {
        if (parseInt(id) !== cascoId) {
          totalSelecionadoAtual += quantidadesProdutoAtual[id];
        }
      }

      let novaQuantidadeCasco = quantidadeCascoAtual + delta;

      if (novaQuantidadeCasco < 0) {
        novaQuantidadeCasco = 0;
      }

      if (totalSelecionadoAtual + novaQuantidadeCasco > quantidadeRequerida) {
        return prev;
      }

      quantidadesProdutoAtual[cascoId] = novaQuantidadeCasco;
      quantidadesAtuais[produtoId] = quantidadesProdutoAtual;

      return quantidadesAtuais;
    });
  };

  const verificarSelecaoCompleta = () => {
    for (const produto of produtosComRetorno) {
      if (!produto.produto_id) continue;
      const quantidadesDesteProduto =
        quantidadesPorCasco[produto.produto_id] || {};
      const totalSelecionado = Object.values(quantidadesDesteProduto).reduce(
        (sum, qty) => sum + qty,
        0,
      );

      if (totalSelecionado !== (produto.quantidade || 0)) {
        return false;
      }
    }
    return true;
  };

  const confirmarEntregaComCascosModal = async () => {
    if (!verificarSelecaoCompleta()) {
      Alert.alert(
        "Atenção",
        "Complete a seleção de cascos para todos os produtos",
      );
      return;
    }

    const cascos: {
      [key: string]: Array<{ casco_id: number; quantidade: number }>;
    } = {};

    for (const produto of produtosComRetorno) {
      if (!produto.produto_id) continue;
      const quantidadesDesteProduto =
        quantidadesPorCasco[produto.produto_id] || {};
      const cascosComQuantidade: Array<{
        casco_id: number;
        quantidade: number;
      }> = [];

      Object.entries(quantidadesDesteProduto).forEach(
        ([cascoIdStr, quantidade]) => {
          if (quantidade > 0) {
            cascosComQuantidade.push({
              casco_id: parseInt(cascoIdStr),
              quantidade: quantidade,
            });
          }
        },
      );

      if (cascosComQuantidade.length > 0) {
        cascos[produto.produto_id.toString()] = cascosComQuantidade;
      }
    }

    setCascoDialogOpen(false);
    setConfirmingDelivery(true);

    await confirmarComCascos(cascos);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1565c0", "#1976d2", "#42a5f5"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando detalhes...</Text>
      </LinearGradient>
    );
  }

  if (!pedido) {
    return null;
  }

  const canConfirmDelivery = pedido.status === "em_entrega";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statusCard}>
        <View style={styles.pedidoInfoRow}>
          <Text style={styles.pedidoId}>Pedido #{pedido.id}</Text>
          <Text style={styles.pedidoData}>{formatDate(pedido.criado_em)}</Text>
        </View>
        <AnimatedStatusBadge
          status={pedido.status}
          pulseAnim={pulseAnim}
          checkAnim={checkAnim}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Cliente</Text>
          </View>
          <Text style={styles.clienteNome}>{pedido.cliente.nome}</Text>
          <TouchableOpacity
            style={styles.telefoneRow}
            onPress={() => Linking.openURL(`tel:${pedido.cliente.telefone}`)}
          >
            <Ionicons name="call" size={18} color="#1976d2" />
            <Text style={styles.telefoneText}>{pedido.cliente.telefone}</Text>
          </TouchableOpacity>
          {pedido.status === "em_entrega" &&
            pedido.criado_em &&
            (() => {
              try {
                const tempoEspera = calcularTempoEspera(pedido.criado_em);
                const agora = new Date();
                const criacao = new Date(pedido.criado_em);
                const diffDias = Math.floor(
                  (agora.getTime() - criacao.getTime()) / (1000 * 60 * 60 * 24),
                );

                if (diffDias > 30) {
                  return (
                    <View style={styles.tempoEsperaContainer}>
                      <Ionicons name="time" size={18} color="#ff9800" />
                      <Text style={styles.tempoEsperaText}>
                        Criado em {formatDate(pedido.criado_em)}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.tempoEsperaContainer}>
                    <Ionicons name="time" size={18} color="#ff9800" />
                    <Text
                      style={styles.tempoEsperaText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tempoEspera}
                    </Text>
                  </View>
                );
              } catch (error) {
                console.error("Erro ao calcular tempo de espera:", error);
                return null;
              }
            })()}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
          </View>
          <Text style={styles.enderecoText}>{pedido.endereco_entrega}</Text>

          <TouchableOpacity
            style={styles.navegacaoButton}
            onPress={abrirNavegacao}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#4caf50", "#388e3c"]}
              style={styles.navegacaoButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={styles.navegacaoButtonText}>Abrir Navegação</Text>
            </LinearGradient>
          </TouchableOpacity>

          {geocoding && (
            <View style={styles.geocodingContainer}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.geocodingText}>Localizando endereço...</Text>
            </View>
          )}

          {geocodeError && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={18} color="#f44336" />
              <Text style={styles.errorText}>{geocodeError}</Text>
            </View>
          )}

          {location && !geocoding && (
            <View style={styles.mapContainer}>
              <MapViewComponent
                latitude={location.latitude}
                longitude={location.longitude}
                title={pedido.cliente.nome}
                description={pedido.endereco_entrega}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="cube" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Itens do Pedido</Text>
          </View>
          {pedido.itens &&
          Array.isArray(pedido.itens) &&
          pedido.itens.length > 0 ? (
            pedido.itens.map((item, index) => {
              if (!item) return null;

              const nomeProduto =
                item.nome_produto || item.produto_nome || "Produto sem nome";
              const quantidade = item.quantidade || 0;
              const valorUnitario =
                item.preco_unitario || item.valor_unitario || 0;

              return (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemNome}>{nomeProduto}</Text>
                    <Text style={styles.itemQtd}>Quantidade: {quantidade}</Text>
                    {item.retorna_botija && (
                      <View style={styles.botijaTag}>
                        <Ionicons
                          name="swap-horizontal"
                          size={12}
                          color="#ff9800"
                        />
                        <Text style={styles.botijaText}>Retorna botija</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemValor}>
                    {formatCurrency(valorUnitario)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ fontSize: 14, color: "#999" }}>
                Nenhum item encontrado
              </Text>
            </View>
          )}
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalContent}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Valor Total</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(pedido.valor_total)}
              </Text>
            </View>
            <LinearGradient
              colors={
                pedido.pagamento_realizado
                  ? ["#4caf50", "#388e3c"]
                  : ["#ff9800", "#f57c00"]
              }
              style={styles.statusPagamentoBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.statusPagamentoText}>
                {pedido.pagamento_realizado
                  ? `Pago - ${pedido.forma_pagamento || "N/A"}`
                  : "Aguardando Pagamento"}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {canConfirmDelivery && (
          <TouchableOpacity
            style={[
              styles.confirmarButton,
              confirmingDelivery && styles.buttonDisabled,
            ]}
            onPress={handleConfirmarEntrega}
            disabled={confirmingDelivery}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={
                confirmingDelivery
                  ? ["#ccc", "#999"]
                  : ["#4caf50", "#388e3c", "#2e7d32"]
              }
              style={styles.confirmarButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {confirmingDelivery ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={26} color="#fff" />
                  <Text style={styles.confirmarButtonText}>
                    Confirmar Entrega
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal
        visible={cascoDialogOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCascoDialogOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={["#1565c0", "#1976d2"]}
              style={styles.modalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.modalTitle}>
                Selecionar Cascos Devolvidos
              </Text>
              <TouchableOpacity onPress={() => setCascoDialogOpen(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>
                Especifique a quantidade de cada tipo de casco devolvido pelo
                cliente:
              </Text>

              {produtosComRetorno.map((produto) => {
                if (!produto.produto_id) return null;

                const cascosDesteProduto =
                  cascosDisponiveis[produto.produto_id] || [];
                const quantidadesDesteProduto =
                  quantidadesPorCasco[produto.produto_id] || {};
                const totalSelecionado = Object.values(
                  quantidadesDesteProduto,
                ).reduce((sum, qty) => sum + qty, 0);

                return (
                  <View key={produto.produto_id} style={styles.produtoCard}>
                    <Text style={styles.produtoNome}>
                      {produto.nome_produto}
                    </Text>
                    <Text style={styles.produtoInfo}>
                      Quantidade: {produto.quantidade} | Selecionado:{" "}
                      {totalSelecionado}/{produto.quantidade}
                    </Text>

                    {cascosDesteProduto.length === 0 ? (
                      <Text style={styles.errorText}>
                        Nenhum casco disponível
                      </Text>
                    ) : (
                      cascosDesteProduto.map((casco) => {
                        const quantidadeAtual =
                          quantidadesDesteProduto[casco.id] || 0;
                        const desabilitarMais =
                          totalSelecionado >= (produto.quantidade || 0);
                        const desabilitarMenos = quantidadeAtual === 0;

                        return (
                          <View key={casco.id} style={styles.cascoItem}>
                            <Text style={styles.cascoNome}>{casco.nome}</Text>
                            <View style={styles.quantitySelector}>
                              <TouchableOpacity
                                style={[
                                  styles.quantityButton,
                                  desabilitarMenos &&
                                    styles.quantityButtonDisabled,
                                ]}
                                onPress={() =>
                                  handleIncrementoCasco(produto, casco.id, -1)
                                }
                                disabled={desabilitarMenos}
                              >
                                <Ionicons
                                  name="remove"
                                  size={20}
                                  color={desabilitarMenos ? "#ccc" : "#1976d2"}
                                />
                              </TouchableOpacity>

                              <Text style={styles.quantityValue}>
                                {quantidadeAtual}
                              </Text>

                              <TouchableOpacity
                                style={[
                                  styles.quantityButton,
                                  desabilitarMais &&
                                    styles.quantityButtonDisabled,
                                ]}
                                onPress={() =>
                                  handleIncrementoCasco(produto, casco.id, 1)
                                }
                                disabled={desabilitarMais}
                              >
                                <Ionicons
                                  name="add"
                                  size={20}
                                  color={desabilitarMais ? "#ccc" : "#1976d2"}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setCascoDialogOpen(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={confirmarEntregaComCascosModal}
                disabled={!verificarSelecaoCompleta() || confirmingDelivery}
              >
                <LinearGradient
                  colors={
                    !verificarSelecaoCompleta() || confirmingDelivery
                      ? ["#ccc", "#999"]
                      : ["#4caf50", "#388e3c"]
                  }
                  style={styles.confirmModalButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {confirmingDelivery ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmModalButtonText}>
                      Confirmar Entrega
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#1976d2",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#e3f2fd",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -10,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pedidoInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  pedidoId: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  pedidoData: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 0.3,
  },
  clienteNome: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  telefoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#e3f2fd",
    borderRadius: 10,
    marginTop: 4,
  },
  telefoneText: {
    fontSize: 16,
    color: "#1976d2",
    marginLeft: 10,
    fontWeight: "600",
  },
  enderecoText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 24,
    marginBottom: 12,
  },
  geocodingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 14,
    backgroundColor: "#e3f2fd",
    borderRadius: 12,
  },
  geocodingText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#1976d2",
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 14,
    backgroundColor: "#ffebee",
    borderRadius: 12,
  },
  errorText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#f44336",
    flex: 1,
    fontWeight: "500",
  },
  mapContainer: {
    marginTop: 16,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  itemQtd: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  botijaTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#fff3e0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  botijaText: {
    fontSize: 12,
    color: "#ff9800",
    marginLeft: 4,
    fontWeight: "600",
  },
  itemValor: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1976d2",
  },
  totalSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  totalContent: {
    flex: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1976d2",
    letterSpacing: 0.5,
  },
  navegacaoButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
    shadowColor: "#4caf50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  navegacaoButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  navegacaoButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  confirmarButton: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === "android" ? 30 : 0,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#4caf50",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmarButtonGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  confirmarButtonText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "bold",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    letterSpacing: 0.3,
  },
  modalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
  },
  produtoCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  produtoNome: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#333",
  },
  produtoInfo: {
    fontSize: 13,
    color: "#666",
    marginBottom: 14,
  },
  cascoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  cascoNome: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
    shadowColor: "#1976d2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  quantityButtonDisabled: {
    backgroundColor: "#f5f5f5",
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  quantityValue: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#333",
    minWidth: 32,
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: Platform.OS === "android" ? 30 : 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  cancelModalButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ccc",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalButtonText: {
    color: "#666",
    fontWeight: "700",
    fontSize: 16,
  },
  confirmModalButton: {
    shadowColor: "#4caf50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmModalButtonGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmModalButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  tempoEsperaContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#fff3e0",
    borderRadius: 10,
  },
  tempoEsperaText: {
    fontSize: 14,
    color: "#ff9800",
    marginLeft: 10,
    fontWeight: "600",
  },
  statusPagamentoBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusPagamentoText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
