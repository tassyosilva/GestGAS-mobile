import axios from 'axios';

interface GeocodingResult {
    lat: string;
    lon: string;
    display_name: string;
}

class GeocodingService {
    private async tryGeocode(address: string): Promise<GeocodingResult | null> {
        try {
            const encodedAddress = encodeURIComponent(address);
            const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=br`;

            console.log('  Tentando:', address);

            const response = await axios.get<GeocodingResult[]>(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'GestGasEntregasApp/1.0',
                    'Accept': 'application/json',
                },
            });

            if (response.data && response.data.length > 0) {
                console.log('  ✅ Sucesso! Local:', response.data[0].display_name);
                return response.data[0];
            }

            console.log('  ❌ Nenhum resultado');
            return null;
        } catch (error) {
            console.log('  ❌ Erro na requisição');
            return null;
        }
    }

    private extractAddressVariations(fullAddress: string): string[] {
        console.log('Extraindo variações do endereço...');

        const variations: string[] = [];

        // Limpar o endereço
        let cleaned = fullAddress
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

        // Extrair componentes usando regex
        const ruaMatch = cleaned.match(/RUA\s+([^,]+)/i);
        const numeroMatch = cleaned.match(/,\s*(\d+)/);
        const bairroMatch = cleaned.match(/BAIRRO\s+([^,]+)/i);
        const cepMatch = cleaned.match(/CEP\s*([\d-]+)/i);
        const cidadeMatch = cleaned.match(/BOA\s+VISTA|RORAIMA|RR/i);

        const rua = ruaMatch ? ruaMatch[1].trim() : '';
        const numero = numeroMatch ? numeroMatch[1].trim() : '';
        const bairro = bairroMatch ? bairroMatch[1].trim() : '';
        const cep = cepMatch ? cepMatch[1].trim() : '';

        console.log('Componentes extraídos:', { rua, numero, bairro, cep });

        // Estratégia 1: Endereço completo original
        variations.push(fullAddress);

        // Estratégia 2: Rua + Número + Boa Vista RR
        if (rua && numero) {
            variations.push(`${rua}, ${numero}, Boa Vista, Roraima, Brasil`);
            variations.push(`${rua} ${numero}, Boa Vista RR Brasil`);
        }

        // Estratégia 3: Rua + Bairro + Boa Vista
        if (rua && bairro) {
            variations.push(`${rua}, ${bairro}, Boa Vista, Roraima`);
        }

        // Estratégia 4: Apenas Rua + Boa Vista
        if (rua) {
            variations.push(`${rua}, Boa Vista, RR, Brasil`);
            variations.push(`${rua}, Boa Vista, Roraima`);
        }

        // Estratégia 5: Bairro + Boa Vista (para ter pelo menos a região)
        if (bairro) {
            variations.push(`${bairro}, Boa Vista, Roraima, Brasil`);
        }

        // Estratégia 6: CEP (se disponível)
        if (cep) {
            variations.push(cep);
        }

        // Estratégia 7: Apenas a cidade como último recurso
        variations.push('Boa Vista, Roraima, Brasil');

        // Remover duplicatas
        const unique = [...new Set(variations)];

        console.log(`Total de ${unique.length} variações para tentar`);
        return unique;
    }

    async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
        console.log('=== INICIANDO GEOCODING ===');
        console.log('Endereço recebido:', address);

        try {
            const variations = this.extractAddressVariations(address);

            // Tentar cada variação em ordem
            for (let i = 0; i < variations.length; i++) {
                console.log(`\nTentativa ${i + 1}/${variations.length}:`);

                const result = await this.tryGeocode(variations[i]);

                if (result) {
                    const coords = {
                        latitude: parseFloat(result.lat),
                        longitude: parseFloat(result.lon),
                    };

                    console.log('\n✅ COORDENADAS ENCONTRADAS:', coords);
                    console.log('Local completo:', result.display_name);

                    return coords;
                }

                // Pequeno delay entre requisições para não sobrecarregar a API
                if (i < variations.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log('\n❌ NENHUMA VARIAÇÃO RETORNOU RESULTADO');
            return null;

        } catch (error: any) {
            console.error('=== ERRO NO GEOCODING ===');
            console.error('Mensagem:', error.message);
            return null;
        }
    }
}

export const geocodingService = new GeocodingService();