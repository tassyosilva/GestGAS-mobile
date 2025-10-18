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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { pedidosService } from '../services/pedidoService';
import { geocodingService } from '../services/geocodingService';
import { PedidoDetalhes, ItemPedido } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import MapViewComponent from '../components/MapView';
import * as Linking from 'expo-linking';
import SelecionarCascosModal from '../components/SelecionarCascosModal';
import { gruposService } from '../services/gruposService';

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
    const [mostrarModalCascos, setMostrarModalCascos] = useState(false);
    const [gruposComRetorno, setGruposComRetorno] = useState<Map<number, any[]>>(new Map());
    const [verificandoGrupos, setVerificandoGrupos] = useState(false);

    useEffect(() => {
        loadPedidoDetalhes();
    }, [pedidoId]);

    useEffect(() => {
        if (pedido && pedido.endereco_entrega) {
            geocodeAddress(pedido.endereco_entrega);
        }
    }, [pedido]);

    const abrirNavegacao = () => {
        if (!pedido) return;

        const endereco = pedido.endereco_entrega;
        console.log('Abrindo navegação para:', endereco);

        // Encode do endereço
        const enderecoEncoded = encodeURIComponent(endereco);

        // Opções de navegação
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

        // Tentar abrir em ordem de preferência
        const tentarAbrir = async () => {
            // 1. Tentar Waze primeiro
            const wazeUrl = opcoes[0].url;
            if (wazeUrl) { // Verificação para satisfazer o TypeScript
                try {
                    const wazeSupported = await Linking.canOpenURL(wazeUrl);
                    console.log('Waze disponível?', wazeSupported);

                    if (wazeSupported) {
                        await Linking.openURL(wazeUrl);
                        return;
                    }
                } catch (error) {
                    console.log('Waze não disponível, tentando próximo...');
                }
            }


            // 2. Tentar Google Maps app
            const googleMapsUrl = opcoes[1].url;
            if (googleMapsUrl) { // Verificação para o valor que pode ser undefined
                try {
                    const googleMapsSupported = await Linking.canOpenURL(googleMapsUrl);
                    console.log('Google Maps app disponível?', googleMapsSupported);

                    if (googleMapsSupported) {
                        await Linking.openURL(googleMapsUrl);
                        return;
                    }
                } catch (error) {
                    console.log('Google Maps app não disponível, tentando web...');
                }
            }

            // 3. Fallback: Abrir Google Maps no navegador
            try {
                console.log('Abrindo Google Maps web...');
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
        console.log('=== INICIANDO GEOCODIFICAÇÃO ===');
        console.log('Endereço para geocodificar:', address);

        try {
            setGeocoding(true);
            setGeocodeError(null);

            const coords = await geocodingService.geocodeAddress(address);

            console.log('Resultado do geocoding:', coords);

            if (coords) {
                console.log('✅ Coordenadas encontradas, setando location');
                setLocation(coords);
            } else {
                console.log('❌ Nenhuma coordenada retornada');
                setGeocodeError('Não foi possível localizar o endereço no mapa. Tente adicionar mais detalhes como cidade e estado.');
            }
        } catch (error) {
            console.error('❌ Erro capturado no geocodeAddress:', error);
            setGeocodeError('Erro ao buscar localização');
        } finally {
            console.log('Finalizando geocoding, setando geocoding=false');
            setGeocoding(false);
        }
    };

    const handleConfirmarEntrega = async () => {
        if (!pedido) return;

        console.log('=== INICIANDO CONFIRMAÇÃO DE ENTREGA ===');

        // Verificar se há produtos com retorno de botija
        const temBotijasParaRetornar = pedido.itens.some(
            (item: ItemPedido) => item.retorna_botija
        );

        console.log('Tem botijas para retornar?', temBotijasParaRetornar);

        if (!temBotijasParaRetornar) {
            // Caso simples: sem botijas retornáveis
            confirmarSemSelecaoCascos();
            return;
        }

        // Verificar se há grupos retornáveis
        const temGrupos = await verificarGruposRetornaveis();
        console.log('Tem grupos retornáveis?', temGrupos);

        if (temGrupos) {
            // Mostrar modal de seleção de cascos
            console.log('Abrindo modal de seleção de cascos');
            setMostrarModalCascos(true);
        } else {
            // Confirmar sem seleção (produtos retornáveis mas sem grupos)
            confirmarSemSelecaoCascos();
        }
    };

    // Confirmar entrega SEM seleção de cascos
    const confirmarSemSelecaoCascos = () => {
        if (!pedido) return;

        Alert.alert(
            'Confirmar Entrega',
            'Deseja confirmar que este pedido foi entregue?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        try {
                            setConfirmingDelivery(true);

                            await pedidosService.confirmarEntrega({
                                pedido_id: pedido.id,
                            });

                            const temBotijasParaRetornar = pedido.itens.some(
                                (item: ItemPedido) => item.retorna_botija
                            );

                            if (temBotijasParaRetornar) {
                                try {
                                    await pedidosService.registrarBotijas(pedido.id);
                                    Alert.alert(
                                        'Sucesso',
                                        'Entrega confirmada e botijas vazias registradas!',
                                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                                    );
                                } catch (botijasError) {
                                    console.error('Erro ao registrar botijas:', botijasError);
                                    Alert.alert(
                                        'Atenção',
                                        'Entrega confirmada, mas houve erro ao registrar botijas vazias.',
                                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                                    );
                                }
                            } else {
                                Alert.alert(
                                    'Sucesso',
                                    'Entrega confirmada com sucesso!',
                                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                                );
                            }
                        } catch (error: any) {
                            console.error('Erro ao confirmar entrega:', error);

                            let errorMessage = 'Erro ao confirmar entrega';
                            if (error.response?.data) {
                                errorMessage = error.response.data;
                            }

                            Alert.alert('Erro', errorMessage);
                        } finally {
                            setConfirmingDelivery(false);
                        }
                    },
                },
            ]
        );
    };

    // Confirmar entrega COM cascos selecionados
    const confirmarComCascosSelecionados = async (cascosSelecionados: number[]) => {
        if (!pedido) return;

        console.log('=== CONFIRMANDO COM CASCOS SELECIONADOS ===');
        console.log('Cascos:', cascosSelecionados);

        setMostrarModalCascos(false);
        setConfirmingDelivery(true);

        try {
            await pedidosService.confirmarEntrega({
                pedido_id: pedido.id,
                cascos: cascosSelecionados,
            });

            Alert.alert(
                'Sucesso',
                'Entrega confirmada com os cascos selecionados!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Erro ao confirmar entrega com cascos:', error);

            let errorMessage = 'Erro ao confirmar entrega';
            if (error.response?.data) {
                errorMessage = typeof error.response.data === 'string'
                    ? error.response.data
                    : error.response.data.message || errorMessage;
            }

            Alert.alert('Erro', errorMessage);
        } finally {
            setConfirmingDelivery(false);
        }
    };

    const verificarGruposRetornaveis = async () => {
        if (!pedido) return false;

        console.log('=== VERIFICANDO GRUPOS RETORNÁVEIS ===');
        setVerificandoGrupos(true);

        try {
            const grupos = await gruposService.obterGruposDoPedido(pedido.id);
            console.log('Grupos com retorno encontrados:', grupos.size);

            setGruposComRetorno(grupos);
            return grupos.size > 0;
        } catch (error) {
            console.error('Erro ao verificar grupos:', error);
            return false;
        } finally {
            setVerificandoGrupos(false);
        }
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
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="location" size={20} color="#1976d2" />
                        <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
                    </View>
                    <Text style={styles.enderecoText}>{pedido.endereco_entrega}</Text>

                    {/* Botão de Navegação */}
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
                    {pedido.itens.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemNome}>{item.nome_produto}</Text>
                                <Text style={styles.itemQtd}>Quantidade: {item.quantidade}</Text>
                                {item.retorna_botija && (
                                    <View style={styles.botijaTag}>
                                        <Ionicons name="swap-horizontal" size={12} color="#ff9800" />
                                        <Text style={styles.botijaText}>Retorna botija</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.itemValor}>
                                {formatCurrency(item.preco_unitario || item.valor_unitario || 0)}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Valor Total</Text>
                    <Text style={styles.totalValue}>{formatCurrency(pedido.valor_total)}</Text>
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
            <SelecionarCascosModal
                visible={mostrarModalCascos}
                pedidoId={pedido?.id || 0}
                gruposComRetorno={gruposComRetorno}
                onConfirm={confirmarComCascosSelecionados}
                onCancel={() => setMostrarModalCascos(false)}
            />
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
});