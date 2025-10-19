import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Coordenadas {
    latitude: number;
    longitude: number;
}

interface CacheEntry {
    coords: Coordenadas;
    timestamp: number;
}

class GeocodingService {
    private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
    private readonly CACHE_KEY = '@geocoding_cache';
    private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dias
    private cache: Map<string, CacheEntry> = new Map();
    private lastRequestTime = 0;
    private readonly MIN_REQUEST_INTERVAL = 1100; // 1.1 segundos (margem de segurança)

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
            console.error('Erro ao carregar cache:', error);
        }
    }

    private async saveCache() {
        try {
            const entries = Object.fromEntries(this.cache);
            await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(entries));
        } catch (error) {
            console.error('Erro ao salvar cache:', error);
        }
    }

    private getCacheKey(address: string): string {
        return address.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    private async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            console.log(`⏳ Aguardando ${waitTime}ms para respeitar rate limit...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    async geocodeAddress(address: string): Promise<Coordenadas | null> {
        try {
            console.log('🌍 Geocodificando endereço:', address);

            // Verificar cache
            const cacheKey = this.getCacheKey(address);
            const cached = this.cache.get(cacheKey);

            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (age < this.CACHE_DURATION) {
                    console.log('✅ Usando coordenadas do cache (idade:', Math.round(age / (24 * 60 * 60 * 1000)), 'dias)');
                    return cached.coords;
                } else {
                    console.log('⏰ Cache expirado, buscando novamente...');
                    this.cache.delete(cacheKey);
                }
            }

            // Respeitar rate limit
            await this.waitForRateLimit();

            console.log('🌐 Fazendo requisição ao Nominatim...');
            const response = await axios.get(`${this.NOMINATIM_BASE_URL}/search`, {
                params: {
                    q: address,
                    format: 'json',
                    limit: 1,
                    addressdetails: 1,
                },
                headers: {
                    'User-Agent': 'GestGAS-Mobile/1.0 (gestgas@example.com)', // MUDE PARA SEU EMAIL
                },
                timeout: 10000,
            });

            if (response.data && response.data.length > 0) {
                const location = response.data[0];
                console.log('✅ Coordenadas encontradas:', location);

                const coords: Coordenadas = {
                    latitude: parseFloat(location.lat),
                    longitude: parseFloat(location.lon),
                };

                // Salvar no cache
                this.cache.set(cacheKey, {
                    coords,
                    timestamp: Date.now(),
                });

                // Salvar cache em disco (não bloquear)
                this.saveCache().catch(err => console.error('Erro ao salvar cache:', err));

                return coords;
            }

            console.log('❌ Nenhuma coordenada encontrada para o endereço');
            return null;
        } catch (error: any) {
            console.error('❌ Erro ao geocodificar endereço:', error);

            if (error.response?.status === 429) {
                console.error('🚫 Rate limit excedido! Aguarde antes de fazer novas requisições.');
            }

            return null;
        }
    }

    // Método para limpar cache antigo
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