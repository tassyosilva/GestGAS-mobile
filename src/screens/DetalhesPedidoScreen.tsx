import React, { useState, useEffect } from 'react';
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
    TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { pedidosService } from '../services/pedidoService';
import { geocodingService } from '../services/geocodingService';
import { PedidoDetalhes, ItemPedido } from '../types';
import { formatCurrency, formatDate, calcularTempoEspera } from '../utils/formatters';
import MapViewComponent from '../components/MapView';
import * as Linking from 'expo-linking';
import { gruposService } from '../services/gruposService';
import { api } from '../services/apiService';

interface Props {
    route: any;
    navigation: any;
}

export default function DetalhesPedidoScreen({ route, navigation }: Props) {
    const { pedidoId } = route.params;

    const [pedido, setPedido] = useState<PedidoDetalhes | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmingDelivery, setConfirmingDelivery] = useState(false);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState<string | null>(null);
    const [cascoDialogOpen, setCascoDialogOpen] = useState(false);
    const [cascosDisponiveis, setCascosDisponiveis] = useState<{ [key: number]: any[] }>({});
    const [quantidadesPorCasco, setQuantidadesPorCasco] = useState<{ [key: number]: { [casco_id: number]: number } }>({});
    const [produtosComRetorno, setProdutosComRetorno] = useState<ItemPedido[]>([]);

    useEffect(() => {
        loadPedidoDetalhes();
    }, [pedidoId]);

    useEffect(() => {
        if (pedido && pedido.endereco_entrega && typeof pedido.endereco_entrega === 'string' && pedido.endereco_entrega.trim().length > 0) {
            geocodeAddress(pedido.endereco_entrega);
        } else if (pedido && !pedido.endereco_entrega) {
            console.log('Pedido sem endereço de entrega');
            setGeocodeError('Endereço de entrega não disponível');
        }
    }, [pedido]);

    const simplificarEnderecoParaNavegacao = (endereco: string): string => {
        let enderecoSimplificado = endereco;

        // Remover CEP
        enderecoSimplificado = enderecoSimplificado.replace(/,?\s*CEP\s*:?\s*[\d\-\.]+/gi, '');

        // Remover complementos residenciais (Casa, Apartamento, Apto, etc.)
        enderecoSimplificado = enderecoSimplificado.replace(/,\s*(Casa|Apartamento|Apto|Ap|Sala|Loja|Galpão|Sobrado|Bloco|Torre)\b[^,]*/gi, '');

        // Remover bairros genéricos ou não informados
        enderecoSimplificado = enderecoSimplificado.replace(/,\s*Bairro\s+(Outros\/Não informado|Não informado|Outros|N\/A|S\/N)\b[^,]*/gi, '');

        // Limpar "Bairro" genérico
        enderecoSimplificado = enderecoSimplificado.replace(/,?\s*Bairro\s+/gi, ', ');

        // Normalizar vírgulas e espaços
        enderecoSimplificado = enderecoSimplificado.replace(/\s*,\s*/g, ', ');
        enderecoSimplificado = enderecoSimplificado.replace(/,+/g, ',');
        enderecoSimplificado = enderecoSimplificado.trim().replace(/^,|,$/g, '');

        return enderecoSimplificado;
    };

    const abrirNavegacao = () => {
        if (!pedido) return;

        const enderecoOriginal = pedido.endereco_entrega;
        const endereco = simplificarEnderecoParaNavegacao(enderecoOriginal);

        console.log('Abrindo navegação para:', endereco);

        const enderecoEncoded = encodeURIComponent(endereco);

        const opcoes = [
            {
                nome: 'Waze',
                url: `waze://?q=${enderecoEncoded}`,
                webUrl: `https://waze.com/ul?q=${enderecoEncoded}`,
            },
            {
                nome: 'Google Maps',
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
                } catch (error) {
                    console.log('Waze não disponível, tentando próximo...');
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
                } catch (error) {
                    console.log('Google Maps app não disponível, tentando web...');
                }
            }

            try {
                await Linking.openURL(opcoes[1].webUrl);
            } catch (error) {
                console.error('Erro ao abrir qualquer opção:', error);
                Alert.alert('Erro', 'Não foi possível abrir o aplicativo de navegação');
            }
        };

        tentarAbrir();
    };

    const loadPedidoDetalhes = async () => {
        try {
            setLoading(true);
            const data = await pedidosService.obterPedidoDetalhes(pedidoId);

            // Validar estrutura mínima do pedido
            if (!data || !data.id) {
                throw new Error('Dados do pedido inválidos');
            }

            // Garantir que itens seja array
            if (!data.itens || !Array.isArray(data.itens)) {
                data.itens = [];
            }

            // Garantir que cliente existe
            if (!data.cliente) {
                data.cliente = { id: 0, nome: 'Cliente não informado', telefone: '' };
            }

            console.log('Pedido carregado:', data);
            setPedido(data);
        } catch (error: any) {
            console.error('Erro ao carregar detalhes:', error);
            Alert.alert('Erro', 'Não foi possível carregar os detalhes do pedido');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const geocodeAddress = async (address: string) => {
        try {
            setGeocoding(true);
            setGeocodeError(null);
            const coords = await geocodingService.geocodeAddress(address);
            if (coords) {
                setLocation(coords);
            } else {
                setGeocodeError('Mapa indisponível para este endereço. Abra a navegação para visualizar.');
            }
        } catch (error) {
            console.error('❌ Erro capturado no geocodeAddress:', error);
            setGeocodeError('Erro ao buscar localização');
        } finally {
            setGeocoding(false);
        }
    };

    // FUNÇÃO handleConfirmarEntrega
    const handleConfirmarEntrega = async () => {
        if (!pedido) return;

        console.log('=== INICIANDO CONFIRMAÇÃO DE ENTREGA ===');
        setConfirmingDelivery(true);

        try {
            // 1. Verificar se há produtos com retorno de botija
            const produtosRetornaveis = pedido.itens.filter(item =>
                item.retorna_botija &&
                (item.categoria === 'botija_gas' || item.categoria === 'agua')
            );

            console.log('Produtos retornáveis:', produtosRetornaveis);

            if (produtosRetornaveis.length === 0) {
                // Não há produtos retornáveis, confirmar direto
                await confirmarSemCascos();
                return;
            }

            // 2. Buscar cascos disponíveis para cada produto
            const cascosMap = await gruposService.buscarCascosDisponiveis(produtosRetornaveis);
            console.log('Cascos disponíveis:', cascosMap);

            // 3. Verificar se todos os produtos têm apenas 1 casco
            let todosTemUmCasco = true;
            // MUDAR O TIPO AQUI - usar string como chave
            const cascosAutomaticos: { [key: string]: Array<{ casco_id: number, quantidade: number }> } = {};

            for (const produto of produtosRetornaveis) {
                if (!produto.produto_id) continue;

                const cascosDesteProduto = cascosMap[produto.produto_id] || [];

                if (cascosDesteProduto.length === 0) {
                    console.log(`Produto ${produto.nome_produto} sem cascos disponíveis`);
                    todosTemUmCasco = false;
                    break;
                } else if (cascosDesteProduto.length === 1) {
                    // Atribuir automaticamente - USAR STRING como chave
                    cascosAutomaticos[produto.produto_id.toString()] = [{
                        casco_id: cascosDesteProduto[0].id,
                        quantidade: produto.quantidade || 0
                    }];
                    console.log(`Produto ${produto.nome_produto} tem apenas 1 casco - seleção automática`);
                } else {
                    console.log(`Produto ${produto.nome_produto} tem ${cascosDesteProduto.length} cascos - requer seleção manual`);
                    todosTemUmCasco = false;
                    break;
                }
            }

            // 4. Decidir fluxo
            if (todosTemUmCasco && Object.keys(cascosAutomaticos).length === produtosRetornaveis.length) {
                // Confirmar automaticamente com cascos selecionados
                console.log('Confirmando automaticamente com cascos:', cascosAutomaticos);
                await confirmarComCascos(cascosAutomaticos);
            } else {
                // Abrir modal para seleção manual
                console.log('Abrindo modal para seleção manual');
                setProdutosComRetorno(produtosRetornaveis);
                setCascosDisponiveis(cascosMap);

                // Inicializar quantidades zeradas
                const quantidadesIniciais: { [key: number]: { [casco_id: number]: number } } = {};
                for (const produto of produtosRetornaveis) {
                    if (produto.produto_id) {
                        quantidadesIniciais[produto.produto_id] = {};
                        const cascos = cascosMap[produto.produto_id] || [];
                        cascos.forEach(casco => {
                            quantidadesIniciais[produto.produto_id!][casco.id] = 0;
                        });
                    }
                }
                setQuantidadesPorCasco(quantidadesIniciais);

                setConfirmingDelivery(false);
                setCascoDialogOpen(true);
            }
        } catch (error) {
            console.error('Erro ao processar confirmação:', error);
            Alert.alert('Erro', 'Erro ao processar confirmação de entrega');
            setConfirmingDelivery(false);
        }
    };

    const confirmarSemCascos = async () => {
        try {
            await pedidosService.confirmarEntrega({
                pedido_id: pedido!.id,
            });

            Alert.alert(
                'Sucesso',
                'Entrega confirmada com sucesso!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Erro ao confirmar:', error);
            Alert.alert('Erro', error.response?.data || 'Erro ao confirmar entrega');
        } finally {
            setConfirmingDelivery(false);
        }
    };

    // CORRIGIR FUNÇÃO confirmarComCascos - MUDAR TIPO DO PARÂMETRO
    const confirmarComCascos = async (cascos: { [key: string]: Array<{ casco_id: number, quantidade: number }> }) => {
        try {
            await pedidosService.confirmarEntrega({
                pedido_id: pedido!.id,
                cascos: cascos,
            });

            Alert.alert(
                'Sucesso',
                'Entrega confirmada e cascos registrados com sucesso!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Erro ao confirmar com cascos:', error);
            Alert.alert('Erro', error.response?.data || 'Erro ao confirmar entrega');
        } finally {
            setConfirmingDelivery(false);
        }
    };

    const handleIncrementoCasco = (produto: ItemPedido, cascoId: number, delta: number) => {
        if (!produto.produto_id) return;

        const produtoId = produto.produto_id;
        const quantidadeRequerida = produto.quantidade || 0;

        setQuantidadesPorCasco(prev => {
            const quantidadesAtuais = { ...prev };
            const quantidadesProdutoAtual = { ...(quantidadesAtuais[produtoId] || {}) };
            const quantidadeCascoAtual = quantidadesProdutoAtual[cascoId] || 0;

            // Calcula o total já selecionado para este produto, excluindo o casco atual
            let totalSelecionadoAtual = 0;
            for (const id in quantidadesProdutoAtual) {
                if (parseInt(id) !== cascoId) {
                    totalSelecionadoAtual += quantidadesProdutoAtual[id];
                }
            }

            // Calcula a nova quantidade para o casco que está sendo alterado
            let novaQuantidadeCasco = quantidadeCascoAtual + delta;

            // Garante que não seja menor que 0
            if (novaQuantidadeCasco < 0) {
                novaQuantidadeCasco = 0;
            }

            // Garante que a soma não ultrapasse o total requerido
            if (totalSelecionadoAtual + novaQuantidadeCasco > quantidadeRequerida) {
                // Se tentou incrementar além do limite, apenas retorna o estado anterior
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
            const quantidadesDesteProduto = quantidadesPorCasco[produto.produto_id] || {};
            const totalSelecionado = Object.values(quantidadesDesteProduto).reduce((sum, qty) => sum + qty, 0);

            if (totalSelecionado !== (produto.quantidade || 0)) {
                return false;
            }
        }
        return true;
    };

    // CORRIGIR FUNÇÃO confirmarEntregaComCascosModal
    const confirmarEntregaComCascosModal = async () => {
        if (!verificarSelecaoCompleta()) {
            Alert.alert('Atenção', 'Complete a seleção de cascos para todos os produtos');
            return;
        }

        // Preparar dados - USAR STRING como chave
        const cascos: { [key: string]: Array<{ casco_id: number, quantidade: number }> } = {};

        for (const produto of produtosComRetorno) {
            if (!produto.produto_id) continue;
            const quantidadesDesteProduto = quantidadesPorCasco[produto.produto_id] || {};
            const cascosComQuantidade: Array<{ casco_id: number, quantidade: number }> = [];

            Object.entries(quantidadesDesteProduto).forEach(([cascoIdStr, quantidade]) => {
                if (quantidade > 0) {
                    cascosComQuantidade.push({
                        casco_id: parseInt(cascoIdStr),
                        quantidade: quantidade
                    });
                }
            });

            if (cascosComQuantidade.length > 0) {
                // USAR STRING como chave
                cascos[produto.produto_id.toString()] = cascosComQuantidade;
            }
        }

        setCascoDialogOpen(false);
        setConfirmingDelivery(true);

        await confirmarComCascos(cascos);
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            'em_entrega': '#2196f3',
            'entregue': '#4caf50',
            'pendente': '#ff9800',
            'cancelado': '#f44336',
        };
        return colors[status] || '#999';
    };

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            'em_entrega': 'Em Entrega',
            'entregue': 'Entregue',
            'pendente': 'Pendente',
            'cancelado': 'Cancelado',
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1976d2" />
                <Text style={styles.loadingText}>Carregando detalhes...</Text>
            </View>
        );
    }

    if (!pedido) {
        return null;
    }

    const canConfirmDelivery = pedido.status === 'em_entrega';

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.statusCard}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pedido.status) }]}>
                        <Text style={styles.statusText}>{getStatusLabel(pedido.status)}</Text>
                    </View>
                    <Text style={styles.pedidoId}>Pedido #{pedido.id}</Text>
                    <Text style={styles.pedidoData}>{formatDate(pedido.criado_em)}</Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person" size={20} color="#1976d2" />
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
                    {pedido.status === 'em_entrega' && pedido.criado_em && (() => {
                        try {
                            const tempoEspera = calcularTempoEspera(pedido.criado_em);
                            const agora = new Date();
                            const criacao = new Date(pedido.criado_em);
                            const diffDias = Math.floor((agora.getTime() - criacao.getTime()) / (1000 * 60 * 60 * 24));

                            // Se passou mais de 30 dias, mostrar apenas a data
                            if (diffDias > 30) {
                                return (
                                    <View style={styles.tempoEsperaContainer}>
                                        <Ionicons name="time" size={18} color="#ff9800" />
                                        <Text style={styles.tempoEsperaText}>Criado em {formatDate(pedido.criado_em)}</Text>
                                    </View>
                                );
                            }

                            return (
                                <View style={styles.tempoEsperaContainer}>
                                    <Ionicons name="time" size={18} color="#ff9800" />
                                    <Text style={styles.tempoEsperaText} numberOfLines={1} ellipsizeMode="tail">{tempoEspera}</Text>
                                </View>
                            );
                        } catch (error) {
                            console.error('Erro ao calcular tempo de espera:', error);
                            return null;
                        }
                    })()}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="location" size={20} color="#1976d2" />
                        <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
                    </View>
                    <Text style={styles.enderecoText}>{pedido.endereco_entrega}</Text>

                    <TouchableOpacity
                        style={styles.navegacaoButton}
                        onPress={abrirNavegacao}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="navigate" size={20} color="#fff" />
                        <Text style={styles.navegacaoButtonText}>Abrir Navegação</Text>
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
                        <Ionicons name="cube" size={20} color="#1976d2" />
                        <Text style={styles.sectionTitle}>Itens do Pedido</Text>
                    </View>
                    {pedido.itens && Array.isArray(pedido.itens) && pedido.itens.length > 0 ? (
                        pedido.itens.map((item, index) => {
                            if (!item) return null;

                            const nomeProduto = item.nome_produto || item.produto_nome || 'Produto sem nome';
                            const quantidade = item.quantidade || 0;
                            const valorUnitario = item.preco_unitario || item.valor_unitario || 0;

                            return (
                                <View key={index} style={styles.itemRow}>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemNome}>{nomeProduto}</Text>
                                        <Text style={styles.itemQtd}>Quantidade: {quantidade}</Text>
                                        {item.retorna_botija && (
                                            <View style={styles.botijaTag}>
                                                <Ionicons name="swap-horizontal" size={12} color="#ff9800" />
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
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, color: '#999' }}>Nenhum item encontrado</Text>
                        </View>
                    )}
                </View>

                <View style={styles.totalSection}>
                    <View style={styles.totalContent}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Valor Total</Text>
                            <Text style={styles.totalValue}>{formatCurrency(pedido.valor_total)}</Text>
                        </View>
                        <View style={[
                            styles.statusPagamentoBadge,
                            {
                                backgroundColor: pedido.pagamento_realizado ? '#4caf50' : '#ff9800'
                            }
                        ]}>
                            <Text style={styles.statusPagamentoText}>
                                {pedido.pagamento_realizado
                                    ? `Pago - ${pedido.forma_pagamento || 'N/A'}`
                                    : 'Aguardando Pagamento'}
                            </Text>
                        </View>
                    </View>
                </View>

                {canConfirmDelivery && (
                    <TouchableOpacity
                        style={[styles.confirmarButton, confirmingDelivery && styles.confirmarButtonDisabled]}
                        onPress={handleConfirmarEntrega}
                        disabled={confirmingDelivery}
                        activeOpacity={0.8}
                    >
                        {confirmingDelivery ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                                <Text style={styles.confirmarButtonText}>Confirmar Entrega</Text>
                            </>
                        )}
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
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selecionar Cascos Devolvidos</Text>
                            <TouchableOpacity onPress={() => setCascoDialogOpen(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.modalSubtitle}>
                                Especifique a quantidade de cada tipo de casco devolvido pelo cliente:
                            </Text>

                            {produtosComRetorno.map((produto) => {
                                if (!produto.produto_id) return null;

                                const cascosDesteProduto = cascosDisponiveis[produto.produto_id] || [];
                                const quantidadesDesteProduto = quantidadesPorCasco[produto.produto_id] || {};
                                const totalSelecionado = Object.values(quantidadesDesteProduto).reduce((sum, qty) => sum + qty, 0);

                                return (
                                    <View key={produto.produto_id} style={styles.produtoCard}>
                                        <Text style={styles.produtoNome}>{produto.nome_produto}</Text>
                                        <Text style={styles.produtoInfo}>
                                            Quantidade: {produto.quantidade} | Selecionado: {totalSelecionado}/{produto.quantidade}
                                        </Text>

                                        {cascosDesteProduto.length === 0 ? (
                                            <Text style={styles.errorText}>Nenhum casco disponível</Text>
                                        ) : (
                                            cascosDesteProduto.map((casco) => {
                                                const quantidadeAtual = quantidadesDesteProduto[casco.id] || 0;
                                                const desabilitarMais = totalSelecionado >= (produto.quantidade || 0);
                                                const desabilitarMenos = quantidadeAtual === 0;

                                                return (
                                                    <View key={casco.id} style={styles.cascoItem}>
                                                        <Text style={styles.cascoNome}>{casco.nome}</Text>
                                                        <View style={styles.quantitySelector}>
                                                            <TouchableOpacity
                                                                style={[styles.quantityButton, desabilitarMenos && styles.quantityButtonDisabled]}
                                                                onPress={() => handleIncrementoCasco(produto, casco.id, -1)}
                                                                disabled={desabilitarMenos}
                                                            >
                                                                <Ionicons name="remove" size={20} color="#1976d2" />
                                                            </TouchableOpacity>

                                                            <Text style={styles.quantityValue}>{quantidadeAtual}</Text>

                                                            <TouchableOpacity
                                                                style={[styles.quantityButton, desabilitarMais && styles.quantityButtonDisabled]}
                                                                onPress={() => handleIncrementoCasco(produto, casco.id, 1)}
                                                                disabled={desabilitarMais}
                                                            >
                                                                <Ionicons name="add" size={20} color="#1976d2" />
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
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setCascoDialogOpen(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.confirmButton,
                                    !verificarSelecaoCompleta() && styles.buttonDisabled
                                ]}
                                onPress={confirmarEntregaComCascosModal}
                                disabled={!verificarSelecaoCompleta() || confirmingDelivery}
                            >
                                {confirmingDelivery ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Confirmar Entrega</Text>
                                )}
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
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        backgroundColor: '#1976d2',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
    },
    statusCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -10,
        marginBottom: 16,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    pedidoId: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    pedidoData: {
        fontSize: 14,
        color: '#666',
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 8,
    },
    clienteNome: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    telefoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    telefoneText: {
        fontSize: 16,
        color: '#1976d2',
        marginLeft: 8,
        textDecorationLine: 'underline',
    },
    enderecoText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
    },
    geocodingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
    },
    geocodingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#1976d2',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#ffebee',
        borderRadius: 8,
    },
    errorText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#f44336',
        flex: 1,
    },
    mapContainer: {
        marginTop: 12,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    itemInfo: {
        flex: 1,
        marginRight: 12,
    },
    itemNome: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    itemQtd: {
        fontSize: 14,
        color: '#666',
    },
    botijaTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    botijaText: {
        fontSize: 12,
        color: '#ff9800',
        marginLeft: 4,
        fontWeight: '500',
    },
    itemValor: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    totalSection: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    totalContent: {
        flex: 1,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    confirmarButton: {
        backgroundColor: '#4caf50',
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'android' ? 30 : 0,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    confirmarButtonDisabled: {
        opacity: 0.6,
    },
    confirmarButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    navegacaoButton: {
        backgroundColor: '#4caf50',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    navegacaoButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalContent: {
        padding: 16,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    produtoCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    produtoNome: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    produtoInfo: {
        fontSize: 12,
        color: '#666',
        marginBottom: 12,
    },
    cascoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    cascoNome: {
        flex: 1,
        fontSize: 14,
    },
    quantityInput: {
        width: 60,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        padding: 8,
        textAlign: 'center',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: Platform.OS === 'android' ? 30 : 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: '#4caf50',
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    quantityButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    quantityButtonDisabled: {
        backgroundColor: '#f5f5f5',
        opacity: 0.5,
    },
    quantityValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        minWidth: 30,
        textAlign: 'center',
    },
    tempoEsperaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        marginTop: 4,
        paddingHorizontal: 12,
        backgroundColor: '#fff3e0',
        borderRadius: 8,
    },
    tempoEsperaText: {
        fontSize: 14,
        color: '#ff9800',
        marginLeft: 8,
        fontWeight: '600',
    },
    statusPagamentoBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    statusPagamentoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});