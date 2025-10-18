import { api } from './apiService';
import { API_ENDPOINTS } from '../config/api';
import { Pedido, PedidoDetalhes } from '../types';

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
    async listarPedidosEntregador(params: ListarPedidosParams): Promise<ListarPedidosResponse> {
        try {
            const response = await api.get<ListarPedidosResponse>(API_ENDPOINTS.PEDIDOS, {
                params,
            });
            return response.data;
        } catch (error) {
            console.error('Erro ao listar pedidos:', error);
            throw error;
        }
    }

    async obterPedidoDetalhes(pedidoId: number): Promise<PedidoDetalhes> {
        try {
            const response = await api.get<PedidoDetalhes>(
                API_ENDPOINTS.PEDIDO_DETALHES(pedidoId)
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao obter detalhes do pedido:', error);
            throw error;
        }
    }

    async confirmarEntrega(pedidoId: number): Promise<void> {
        try {
            await api.post(API_ENDPOINTS.CONFIRMAR_ENTREGA, {
                pedido_id: pedidoId,
            });
        } catch (error) {
            console.error('Erro ao confirmar entrega:', error);
            throw error;
        }
    }

    async registrarBotijas(pedidoId: number): Promise<void> {
        try {
            await api.post(API_ENDPOINTS.REGISTRAR_BOTIJAS, {
                pedido_id: pedidoId,
            });
        } catch (error) {
            console.error('Erro ao registrar botijas:', error);
            throw error;
        }
    }
}

export const pedidosService = new PedidosService();