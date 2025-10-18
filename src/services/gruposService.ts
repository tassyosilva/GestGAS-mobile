import { api } from './apiService';

export interface GrupoBotija {
    id: number;
    nome: string;
    descricao?: string;
}

export interface ProdutoComGrupo {
    produto_id: number;
    produto_nome: string;
    grupo_id: number;
    grupo_nome: string;
    categoria: string;
}

class GruposService {
    async listarGrupos(): Promise<GrupoBotija[]> {
        try {
            const response = await api.get<GrupoBotija[]>('/grupos-botijas');
            return response.data;
        } catch (error) {
            console.error('Erro ao listar grupos:', error);
            return [];
        }
    }

    async listarProdutosPorGrupo(grupoId: number): Promise<ProdutoComGrupo[]> {
        try {
            const response = await api.get<ProdutoComGrupo[]>(`/grupos-botijas/${grupoId}/produtos`);
            return response.data;
        } catch (error) {
            console.error('Erro ao listar produtos do grupo:', error);
            return [];
        }
    }

    async obterGruposDoPedido(pedidoId: number): Promise<Map<number, ProdutoComGrupo[]>> {
        try {
            // Buscar detalhes do pedido
            const pedidoResponse = await api.get(`/pedidos/${pedidoId}`);
            const pedido = pedidoResponse.data;

            if (!pedido || !pedido.itens) {
                return new Map();
            }

            // Agrupar produtos que têm retorno de botija
            const gruposMap = new Map<number, ProdutoComGrupo[]>();

            for (const item of pedido.itens) {
                if (!item.retorna_botija) continue;

                // Buscar se o produto pertence a um grupo
                try {
                    const response = await api.get<ProdutoComGrupo[]>('/produtos-grupos', {
                        params: { produto_id: item.produto_id },
                    });

                    if (response.data && response.data.length > 0) {
                        const produtoGrupo = response.data[0];
                        const grupoId = produtoGrupo.grupo_id;

                        if (!gruposMap.has(grupoId)) {
                            gruposMap.set(grupoId, []);
                        }

                        gruposMap.get(grupoId)!.push({
                            produto_id: item.produto_id,
                            produto_nome: item.nome_produto,
                            grupo_id: grupoId,
                            grupo_nome: produtoGrupo.grupo_nome,
                            categoria: produtoGrupo.categoria || 'botija_gas',
                        });
                    }
                } catch (error) {
                    console.log(`Produto ${item.produto_id} não pertence a nenhum grupo`);
                }
            }

            return gruposMap;
        } catch (error) {
            console.error('Erro ao obter grupos do pedido:', error);
            return new Map();
        }
    }
}

export const gruposService = new GruposService();