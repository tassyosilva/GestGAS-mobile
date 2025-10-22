import { api } from "./apiService";
import { API_ENDPOINTS } from "../config/api";
import { ItemPedido } from "../types";

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
  /**
   * Busca cascos disponíveis para um produto específico através do seu grupo
   */
  async buscarCascosParaProduto(produtoId: number): Promise<any[]> {
    try {
      console.log(`🔍 Buscando cascos para produto ${produtoId}`);

      // 1. Buscar todos os grupos
      console.log("🌐 Chamando endpoint:", API_ENDPOINTS.GRUPOS_BOTIJAS);
      const gruposResponse = await api.get(API_ENDPOINTS.GRUPOS_BOTIJAS);

      console.log("📦 Resposta dos grupos:", gruposResponse.data);

      const grupos = gruposResponse.data;

      if (!Array.isArray(grupos)) {
        console.error("❌ Resposta não é um array:", typeof grupos);
        return [];
      }

      console.log(`📦 Total de grupos encontrados: ${grupos.length}`);

      // 2. Para cada grupo, verificar se contém este produto
      for (const grupo of grupos) {
        try {
          console.log(`🔎 Verificando grupo ${grupo.id} - ${grupo.nome}`);

          const detalhesGrupo = await api.get(
            API_ENDPOINTS.GRUPO_DETALHES(grupo.id),
          );

          console.log(
            `📋 Detalhes do grupo ${grupo.id}:`,
            JSON.stringify(detalhesGrupo.data, null, 2),
          );

          if (detalhesGrupo.data && detalhesGrupo.data.produtos) {
            console.log(
              `✅ Grupo ${grupo.id} tem ${detalhesGrupo.data.produtos.length} produtos`,
            );

            // Verificar os diferentes formatos possíveis de ID
            const produtoNoGrupo = detalhesGrupo.data.produtos.find(
              (p: any) => {
                const pId = p.id || p.produto_id;
                console.log(
                  `  Comparando: produto do grupo ID=${pId} com produto procurado ID=${produtoId}`,
                );
                return pId === produtoId;
              },
            );

            if (produtoNoGrupo) {
              // Produto encontrado neste grupo, buscar cascos
              console.log(
                `✅ Produto ${produtoId} encontrado no grupo ${grupo.id}`,
              );

              try {
                const cascosResponse = await api.get(
                  API_ENDPOINTS.GRUPO_CASCOS(grupo.id),
                );
                const cascos = cascosResponse.data || [];
                console.log(
                  `🎯 Cascos encontrados para grupo ${grupo.id}:`,
                  JSON.stringify(cascos, null, 2),
                );
                return cascos;
              } catch (error) {
                console.error(
                  `❌ Erro ao buscar cascos do grupo ${grupo.id}:`,
                  error,
                );
                return [];
              }
            } else {
              console.log(
                `❌ Produto ${produtoId} NÃO está no grupo ${grupo.id}`,
              );
            }
          } else {
            console.log(
              `⚠️ Grupo ${grupo.id} não tem produtos ou estrutura inválida`,
            );
          }
        } catch (error) {
          console.error(
            `❌ Erro ao buscar detalhes do grupo ${grupo.id}:`,
            error,
          );
          continue;
        }
      }

      // Produto não encontrado em nenhum grupo
      console.log(`❌ Produto ${produtoId} não pertence a nenhum grupo`);
      return [];
    } catch (error) {
      console.error(
        `❌ Erro ao buscar cascos para produto ${produtoId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Busca cascos disponíveis para múltiplos produtos
   */
  async buscarCascosDisponiveis(
    produtos: ItemPedido[],
  ): Promise<{ [key: number]: any[] }> {
    console.log(
      `🚀 Iniciando busca de cascos para ${produtos.length} produtos`,
    );
    const cascosMap: { [key: number]: any[] } = {};

    for (const produto of produtos) {
      if (produto.produto_id) {
        console.log(
          `\n--- Processando produto ${produto.produto_id} - ${produto.nome_produto} ---`,
        );
        const cascos = await this.buscarCascosParaProduto(produto.produto_id);
        cascosMap[produto.produto_id] = cascos;
        console.log(
          `✅ Resultado: ${cascos.length} cascos encontrados para produto ${produto.produto_id}`,
        );
      }
    }

    console.log("\n📊 Resumo final de cascos:");
    Object.entries(cascosMap).forEach(([produtoId, cascos]) => {
      console.log(`  Produto ${produtoId}: ${cascos.length} cascos`);
    });

    return cascosMap;
  }
}

export const gruposService = new GruposService();
