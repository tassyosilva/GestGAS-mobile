import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pedidosService } from "../services/pedidoService";

interface CascoOpcao {
  id: number;
  nome: string;
  grupo_nome: string;
  selecionado: boolean;
}

interface Props {
  visible: boolean;
  gruposComRetorno: Map<number, any[]>;
  onConfirm: (cascosSelecionados: number[]) => void;
  onCancel: () => void;
}

export default function SelecionarCascosModal({
  visible,
  gruposComRetorno,
  onConfirm,
  onCancel,
}: Props) {
  const [cascos, setCascos] = useState<CascoOpcao[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarCascos = useCallback(async () => {
    setLoading(true);
    console.log("=== CARREGANDO CASCOS ===");
    console.log("Grupos para processar:", gruposComRetorno.size);

    try {
      const todasOpcoes: CascoOpcao[] = [];

      // Para cada grupo com produtos retornáveis
      for (const [grupoId, produtos] of gruposComRetorno.entries()) {
        console.log(`\n--- Processando Grupo ${grupoId} ---`);
        console.log("Produtos do grupo:", produtos);

        // Buscar cascos deste grupo
        const cascosDoGrupo = await pedidosService.buscarCascosDoGrupo(grupoId);
        console.log(`Cascos encontrados para grupo ${grupoId}:`, cascosDoGrupo);

        if (cascosDoGrupo.length === 0) {
          console.warn(`⚠️ Nenhum casco encontrado para o grupo ${grupoId}`);
          continue;
        }

        // Adicionar cada casco como opção
        for (const casco of cascosDoGrupo) {
          const cascoId = casco.id || casco.produto_id;
          const cascoNome = casco.nome || casco.produto_nome;

          if (!cascoId || !cascoNome) {
            console.warn("Casco com dados incompletos:", casco);
            continue;
          }

          todasOpcoes.push({
            id: cascoId,
            nome: cascoNome,
            grupo_nome: produtos[0]?.grupo_nome || `Grupo ${grupoId}`,
            selecionado: false,
          });

          console.log(`✅ Adicionado casco: ${cascoNome} (ID: ${cascoId})`);
        }
      }

      console.log("\n=== RESUMO ===");
      console.log("Total de opções de cascos:", todasOpcoes.length);
      console.log(
        "Cascos disponíveis:",
        todasOpcoes.map((c) => `${c.nome} (${c.grupo_nome})`),
      );

      if (todasOpcoes.length === 0) {
        Alert.alert(
          "Aviso",
          "Nenhum casco disponível foi encontrado para os produtos retornáveis deste pedido.",
          [{ text: "OK", onPress: onCancel }],
        );
      }

      setCascos(todasOpcoes);
    } catch (_error) {
      console.error("❌ Erro ao carregar cascos:", _error);
      Alert.alert(
        "Erro",
        "Não foi possível carregar as opções de cascos. Tente novamente.",
        [{ text: "OK", onPress: onCancel }],
      );
    } finally {
      setLoading(false);
    }
  }, [gruposComRetorno, onCancel]);

  useEffect(() => {
    console.log("Modal visível:", visible);
    console.log("Grupos com retorno (tamanho):", gruposComRetorno.size);
    console.log(
      "Grupos com retorno (detalhes):",
      Array.from(gruposComRetorno.entries()),
    );

    if (visible && gruposComRetorno.size > 0) {
      carregarCascos();
    } else if (visible && gruposComRetorno.size === 0) {
      console.warn("⚠️ Modal aberto mas nenhum grupo encontrado!");
    }
  }, [visible, gruposComRetorno, carregarCascos]);

  const toggleCasco = (cascoId: number) => {
    console.log("Alternando seleção do casco:", cascoId);
    setCascos((prev) =>
      prev.map((c) =>
        c.id === cascoId ? { ...c, selecionado: !c.selecionado } : c,
      ),
    );
  };

  const handleConfirm = () => {
    const selecionados = cascos.filter((c) => c.selecionado).map((c) => c.id);

    console.log("=== CONFIRMANDO SELEÇÃO ===");
    console.log("Cascos selecionados:", selecionados);
    console.log("Quantidade:", selecionados.length);

    if (selecionados.length === 0) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um casco que foi devolvido pelo cliente.",
        [{ text: "OK" }],
      );
      return;
    }

    onConfirm(selecionados);
  };

  const cascosSelecionados = cascos.filter((c) => c.selecionado).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Selecionar Cascos Retornados</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Selecione quais cascos/botijas vazias o cliente devolveu
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976d2" />
              <Text style={styles.loadingText}>Carregando opções...</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.scrollView}>
                {cascos.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={48}
                      color="#999"
                    />
                    <Text style={styles.emptyText}>
                      Nenhum casco disponível encontrado
                    </Text>
                  </View>
                ) : (
                  cascos.map((casco) => (
                    <TouchableOpacity
                      key={casco.id}
                      style={[
                        styles.cascoItem,
                        casco.selecionado && styles.cascoItemSelected,
                      ]}
                      onPress={() => toggleCasco(casco.id)}
                    >
                      <View style={styles.cascoInfo}>
                        <Text style={styles.cascoNome}>{casco.nome}</Text>
                        <Text style={styles.cascoGrupo}>
                          {casco.grupo_nome}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          casco.selecionado && styles.checkboxSelected,
                        ]}
                      >
                        {casco.selecionado && (
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {/* Footer com contador e botões */}
              <View style={styles.footer}>
                <Text style={styles.counterText}>
                  {cascosSelecionados}{" "}
                  {cascosSelecionados === 1
                    ? "casco selecionado"
                    : "cascos selecionados"}
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      cascosSelecionados === 0 && styles.confirmButtonDisabled,
                    ]}
                    onPress={handleConfirm}
                    disabled={cascosSelecionados === 0}
                  >
                    <Text style={styles.confirmButtonText}>
                      Confirmar Entrega
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    padding: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  scrollView: {
    maxHeight: 400,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  cascoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  cascoItemSelected: {
    backgroundColor: "#e3f2fd",
  },
  cascoInfo: {
    flex: 1,
    marginRight: 12,
  },
  cascoNome: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  cascoGrupo: {
    fontSize: 12,
    color: "#666",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  footer: {
    padding: 16,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  counterText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#1976d2",
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "#ccc",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
