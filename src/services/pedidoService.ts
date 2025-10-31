import { api } from "./apiService";
import { API_ENDPOINTS } from "../config/api";
import { Pedido, PedidoDetalhes, ConfirmarEntregaRequest } from "../types";

interface ListarPedidosParams {
  entregador_id?: number;
  page?: number;
  limit?: number;
}

interface ListarPedidosResponse {
  pedidos: Pedido[];
  total: number;
  page?: number;
  total_pages?: number;
}

class PedidosService {
  async listarPedidosEntregador(
    params: ListarPedidosParams,
  ): Promise<ListarPedidosResponse> {
    try {
      const response = await api.get<ListarPedidosResponse>(
        API_ENDPOINTS.PEDIDOS,
        {
          params,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao listar pedidos:", error);
      throw error;
    }
  }

  async obterPedidoDetalhes(pedidoId: number): Promise<PedidoDetalhes> {
    try {
      const response = await api.get<PedidoDetalhes>(
        API_ENDPOINTS.PEDIDO_DETALHES(pedidoId),
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao obter detalhes do pedido:", error);
      throw error;
    }
  }

  // ATUALIZADO: Agora aceita array de cascos selecionados
  async confirmarEntrega(dados: ConfirmarEntregaRequest): Promise<void> {
    try {
      console.log("Confirmando entrega com dados:", dados);
      await api.post(API_ENDPOINTS.CONFIRMAR_ENTREGA, dados);
    } catch (error) {
      console.error("Erro ao confirmar entrega:", error);
      throw error;
    }
  }

  async registrarBotijas(pedidoId: number): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.REGISTRAR_BOTIJAS, {
        pedido_id: pedidoId,
      });
    } catch (error) {
      console.error("Erro ao registrar botijas:", error);
      throw error;
    }
  }

  async listarPedidosFinalizados(
    params: ListarPedidosParams,
  ): Promise<ListarPedidosResponse> {
    try {
      const response = await api.get<ListarPedidosResponse>(
        API_ENDPOINTS.PEDIDOS_FINALIZADOS,
        {
          params,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao listar pedidos finalizados:", error);
      throw error;
    }
  }

  // NOVO: Buscar cascos disponíveis do grupo
  async buscarCascosDoGrupo(grupoId: number): Promise<any[]> {
    try {
      const response = await api.get(`/grupos-botijas/${grupoId}/produtos`);

      // Filtrar apenas produtos do tipo "casco"
      const produtos = response.data || [];
      return produtos.filter((p: any) => p.categoria === "casco");
    } catch (error) {
      console.error("Erro ao buscar cascos do grupo:", error);
      return [];
    }
  }

  // Registrar contato do entregador com o cliente
  async registrarContato(
    pedidoId: number,
    clienteId: number,
    tipoContato: "telefone" | "whatsapp",
  ): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.REGISTRAR_CONTATO, {
        pedido_id: pedidoId,
        cliente_id: clienteId,
        tipo_contato: tipoContato,
      });
      console.log(`Contato via ${tipoContato} registrado com sucesso`);
    } catch (error) {
      console.error("Erro ao registrar contato:", error);
      // Erro silencioso - não bloqueia a ação do usuário
    }
  }
}

export const pedidosService = new PedidosService();
