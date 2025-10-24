import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

interface CacheEntry {
  coords: Coordenadas;
  timestamp: number;
}

class GeocodingService {
  private readonly NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
  private readonly CACHE_KEY = "@geocoding_cache";
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;
  private cache: Map<string, CacheEntry> = new Map();
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1100;

  constructor() {
    this.loadCache();
  }

  private async loadCache() {
    try {
      const cacheData = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cacheData) {
        const entries = JSON.parse(cacheData);
        this.cache = new Map(Object.entries(entries));
        console.log(`📦 Cache carregado: ${this.cache.size} endereços`);
      }
    } catch (error) {
      console.error("Erro ao carregar cache:", error);
    }
  }

  private async saveCache() {
    try {
      const entries = Object.fromEntries(this.cache);
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error("Erro ao salvar cache:", error);
    }
  }

  private getCacheKey(address: string): string {
    return address.toLowerCase().trim().replace(/\s+/g, " ");
  }

  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏳ Aguardando ${waitTime}ms para respeitar rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private simplificarEndereco(address: string): string {
    let enderecoSimplificado = address;

    // Remover CEP
    enderecoSimplificado = enderecoSimplificado.replace(
      /,?\s*CEP\s*:?\s*[\d\-. ]+/gi,
      "",
    );

    // Remover "ATÉ" e variações
    enderecoSimplificado = enderecoSimplificado.replace(
      /,\s*ATÉ\s+[\d/-]+/gi,
      "",
    );

    // Remover complementos residenciais (Casa, Apartamento, Apto, etc.)
    enderecoSimplificado = enderecoSimplificado.replace(
      /,\s*(Casa|Apartamento|Apto|Ap|Sala|Loja|Galpão|Sobrado|Bloco|Torre)\b[^,]*/gi,
      "",
    );

    // Remover bairros genéricos ou não informados
    enderecoSimplificado = enderecoSimplificado.replace(
      /,\s*Bairro\s+(Outros\/Não informado|Não informado|Outros|N\/A|S\/N)\b[^,]*/gi,
      "",
    );

    // Limpar "Bairro" genérico
    enderecoSimplificado = enderecoSimplificado.replace(
      /,?\s*Bairro\s+/gi,
      ", ",
    );

    // Normalizar vírgulas e espaços
    enderecoSimplificado = enderecoSimplificado.replace(/\s*,\s*/g, ", ");
    enderecoSimplificado = enderecoSimplificado.replace(/,+/g, ",");
    enderecoSimplificado = enderecoSimplificado.trim().replace(/^,|,$/g, "");

    console.log("Endereço original:", address);
    console.log("Endereço simplificado:", enderecoSimplificado);

    return enderecoSimplificado;
  }

  private async tentarGeocodificar(
    endereco: string,
  ): Promise<Coordenadas | null> {
    try {
      await this.waitForRateLimit();

      console.log("Tentando geocodificar:", endereco);
      const response = await axios.get(`${this.NOMINATIM_BASE_URL}/search`, {
        params: {
          q: endereco,
          format: "json",
          limit: 1,
          addressdetails: 1,
          countrycodes: "br",
        },
        headers: {
          "User-Agent": "GestGAS-Mobile/1.0 (gestgas@example.com)",
        },
        timeout: 10000,
      });

      if (response.data && response.data.length > 0) {
        const location = response.data[0];
        console.log("Coordenadas encontradas:", location);

        // CORREÇÃO: Validação rigorosa das coordenadas
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);

        if (
          isNaN(lat) ||
          isNaN(lon) ||
          !isFinite(lat) ||
          !isFinite(lon) ||
          lat < -90 ||
          lat > 90 ||
          lon < -180 ||
          lon > 180
        ) {
          console.error("Coordenadas inválidas recebidas:", { lat, lon });
          return null;
        }

        return {
          latitude: lat,
          longitude: lon,
        };
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error("Rate limit excedido");
      } else {
        console.error("Erro ao geocodificar:", error.message);
      }
      return null;
    }
  }

  private extrairCidadeEstado(address: string): string {
    // Tentar extrair cidade e estado do endereço
    const match = address.match(/([A-Za-zÀ-ú\s]+),\s*([A-Z]{2})(?:\s|,|$)/);
    if (match) {
      return `${match[1].trim()}, ${match[2]}`;
    }
    return "";
  }

  private removerNumero(address: string): string {
    // Remove o número do endereço mantendo rua, cidade e estado
    return address.replace(/,\s*\d+\s*,/, ",");
  }

  async geocodeAddress(address: string): Promise<Coordenadas | null> {
    try {
      console.log("Geocodificando endereço:", address);

      const cacheKey = this.getCacheKey(address);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < this.CACHE_DURATION) {
          console.log(
            "Usando coordenadas do cache (idade:",
            Math.round(age / (24 * 60 * 60 * 1000)),
            "dias)",
          );
          return cached.coords;
        } else {
          console.log("Cache expirado, buscando novamente...");
          this.cache.delete(cacheKey);
        }
      }

      // Estratégia 1: Tentar endereço completo simplificado
      const enderecoSimplificado = this.simplificarEndereco(address);
      console.log("Estratégia 1: Endereço completo simplificado");
      let coords = await this.tentarGeocodificar(enderecoSimplificado);

      // Estratégia 2: Tentar sem o número
      if (!coords) {
        const enderecoSemNumero = this.removerNumero(enderecoSimplificado);
        if (enderecoSemNumero !== enderecoSimplificado) {
          console.log("Estratégia 2: Endereço sem número");
          coords = await this.tentarGeocodificar(enderecoSemNumero);
        }
      }

      // Estratégia 3: Tentar apenas cidade e estado
      if (!coords) {
        const cidadeEstado = this.extrairCidadeEstado(address);
        if (cidadeEstado) {
          console.log("Estratégia 3: Apenas cidade e estado");
          coords = await this.tentarGeocodificar(cidadeEstado);
        }
      }

      if (coords) {
        this.cache.set(cacheKey, {
          coords,
          timestamp: Date.now(),
        });

        this.saveCache().catch((err) =>
          console.error("Erro ao salvar cache:", err),
        );

        return coords;
      }

      console.log("Nenhuma coordenada encontrada após todas as estratégias");
      return null;
    } catch (error: any) {
      console.error("Erro ao geocodificar endereço:", error);
      return null;
    }
  }

  async clearOldCache() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removidos ${removed} itens antigos do cache`);
      await this.saveCache();
    }
  }
}

export const geocodingService = new GeocodingService();
