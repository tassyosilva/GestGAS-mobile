import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { pedidosService } from '../services/pedidoService';
import { Pedido, Usuario, PedidoResolvido } from '../types';
import PedidoCard from '../components/PedidoCard';
import { calcularTempoEntrega, formatShortDate } from '../utils/formatters';

interface Props {
    navigation: any;
    onLogout: () => void;
}

export default function MinhasEntregasScreen({ navigation, onLogout }: Props) {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [pedidosFinalizados, setPedidosFinalizados] = useState<PedidoResolvido[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingFinalizados, setLoadingFinalizados] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [pageFinalizados, setPageFinalizados] = useState(0);
    const [total, setTotal] = useState(0);
    const [totalFinalizados, setTotalFinalizados] = useState(0);
    const [user, setUser] = useState<Usuario | null>(null);
    const [showFinalizados, setShowFinalizados] = useState(false);
    const limit = 20;
    const limitFinalizados = 10;

    useEffect(() => {
        loadUser();
    }, []);

    // ATUALIZADO: Este useEffect agora carrega os dados iniciais
    useEffect(() => {
        if (user) {
            loadPedidos();
            loadTotalFinalizados(); // ADICIONADO: Carrega o total ao iniciar
        }
    }, [user, page]);

    useEffect(() => {
        if (user && pageFinalizados > 0) {
            loadPedidosFinalizados();
        }
    }, [pageFinalizados]);

    const loadUser = async () => {
        try {
            const userData = await authService.getUser();
            setUser(userData);
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            Alert.alert('Erro', 'Não foi possível carregar dados do usuário');
        }
    };

    // NOVO: Função leve para buscar apenas o total de finalizados
    const loadTotalFinalizados = async () => {
        if (!user) return;
        try {
            const response = await pedidosService.listarPedidosFinalizados({
                entregador_id: user.id,
                page: 1,
                limit: 1, // Pede apenas 1 item para ser uma chamada rápida
            });
            if (response && typeof response.total === 'number') {
                setTotalFinalizados(response.total);
            }
        } catch (error) {
            console.error('Erro ao carregar total de finalizados:', error);
        }
    };

    const loadPedidos = async () => {
        if (!user) return;
        try {
            if (page === 0) setLoading(true);
            const response = await pedidosService.listarPedidosEntregador({
                entregador_id: user.id,
                page: page + 1,
                limit,
            });
            if (response && response.pedidos) {
                setPedidos(response.pedidos);
                setTotal(response.total || 0);
            } else {
                setPedidos([]);
                setTotal(0);
            }
        } catch (error: any) {
            console.error('Erro ao carregar entregas:', error);
            let errorMessage = 'Erro ao carregar entregas';
            if (error.response?.status === 401 || error.message === 'Sessão expirada') {
                errorMessage = 'Sessão expirada. Faça login novamente.';
                await authService.logout();
                onLogout();
            } else if (error.message.includes('Network Error')) {
                errorMessage = 'Erro de conexão. Verifique sua internet.';
            }
            Alert.alert('Erro', errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadPedidosFinalizados = async () => {
        if (!user || loadingFinalizados) return;
        try {
            setLoadingFinalizados(true);
            const response = await pedidosService.listarPedidosFinalizados({
                entregador_id: user.id,
                page: pageFinalizados + 1,
                limit: limitFinalizados,
            });
            if (response && response.pedidos) {
                const pedidosResolvidosData = response.pedidos.map((p: any) => ({
                    id: p.id,
                    data_entregador_atribuido: p.data_entregador_atribuido,
                    data_entrega: p.data_entrega,
                    endereco_entrega: p.endereco_entrega,
                    valor_total: p.valor_total,
                    cliente_nome: p.cliente?.nome || p.cliente_nome || 'Cliente',
                    status: p.status,
                    bairro: p.bairro,
                    forma_pagamento: p.forma_pagamento,
                }));
                if (pageFinalizados === 0) {
                    setPedidosFinalizados(pedidosResolvidosData);
                } else {
                    setPedidosFinalizados(prevPedidos => [...prevPedidos, ...pedidosResolvidosData]);
                }
                setTotalFinalizados(response.total || 0);
            } else if (pageFinalizados === 0) {
                setPedidosFinalizados([]);
                setTotalFinalizados(0);
            }
        } catch (error: any) {
            console.error('Erro ao carregar pedidos finalizados:', error);
        } finally {
            setLoadingFinalizados(false);
        }
    };

    // ATUALIZADO: onRefresh agora também atualiza o total
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setPage(0);
        setPageFinalizados(0);
        setPedidosFinalizados([]);

        loadPedidos();
        loadTotalFinalizados(); // ADICIONADO: Atualiza o total ao arrastar

        if (showFinalizados) {
            loadPedidosFinalizados();
        }
    }, [user, showFinalizados]);

    const handlePedidoPress = (pedido: Pedido) => {
        navigation.navigate('DetalhesPedido', { pedidoId: pedido.id });
    };

    const handleLogout = () => {
        Alert.alert(
            'Sair', 'Deseja realmente sair?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sair',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authService.logout();
                            onLogout();
                        } catch (error) {
                            console.error('Erro ao fazer logout:', error);
                            Alert.alert('Erro', 'Não foi possível fazer logout');
                        }
                    },
                },
            ]
        );
    };

    const handleLoadMoreFinalizados = () => {
        if (pedidosFinalizados.length < totalFinalizados && !loadingFinalizados) {
            setPageFinalizados(prev => prev + 1);
        }
    };

    const toggleFinalizados = () => {
        const newState = !showFinalizados;
        setShowFinalizados(newState);
        if (newState && pedidosFinalizados.length === 0) {
            if (pageFinalizados !== 0) {
                setPageFinalizados(0);
            }
            loadPedidosFinalizados();
        }
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhuma entrega pendente</Text>
            <Text style={styles.emptySubtext}>
                Seus pedidos aparecerão aqui quando forem atribuídos a você
            </Text>
        </View>
    );

    const renderPedidoFinalizadoCard = ({ item }: { item: PedidoResolvido }) => (
        <View style={styles.finalizadoCard}>
            <View style={styles.finalizadoHeader}>
                <Text style={styles.finalizadoId}>#{item.id}</Text>
                <Text style={styles.finalizadoCliente}>{item.cliente_nome}</Text>
            </View>
            <View style={styles.finalizadoInfo}>
                {item.bairro && (
                    <View style={styles.finalizadoRow}>
                        <Ionicons name="location-outline" size={14} color="#666" />
                        <Text style={styles.finalizadoText}>{item.bairro}</Text>
                    </View>
                )}
                {item.data_entregador_atribuido && (
                    <View style={styles.finalizadoRow}>
                        <Ionicons name="person-outline" size={14} color="#666" />
                        <Text style={styles.finalizadoText}>
                            Atribuído: {formatShortDate(item.data_entregador_atribuido)}
                        </Text>
                    </View>
                )}
                {item.data_entrega && (
                    <View style={styles.finalizadoRow}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#4caf50" />
                        <Text style={styles.finalizadoText}>
                            Entregue: {formatShortDate(item.data_entrega)}
                        </Text>
                    </View>
                )}
                <View style={styles.finalizadoRow}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.finalizadoText}>
                        Tempo: {calcularTempoEntrega(item.data_entregador_atribuido, item.data_entrega)}
                    </Text>
                </View>
                {item.forma_pagamento && (
                    <View style={styles.finalizadoRow}>
                        <Ionicons name="card-outline" size={14} color="#666" />
                        <Text style={styles.finalizadoText}>{item.forma_pagamento}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderFooter = () => {
        if (!loading || pedidos.length === 0) return null;
        return <ActivityIndicator style={styles.loadingFooter} color="#1976d2" />;
    };

    const renderFooterFinalizados = () => {
        if (!loadingFinalizados) return null;
        return <ActivityIndicator style={styles.loadingFooter} color="#1976d2" />;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Minhas Entregas</Text>
                    {user && <Text style={styles.headerSubtitle}>{user.nome}</Text>}
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Ionicons name="log-out-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{total}</Text>
                    <Text style={styles.statLabel}>Ativas</Text>
                </View>
                <View style={[styles.statBox, styles.statBoxLast]}>
                    <Text style={styles.statValue}>{totalFinalizados}</Text>
                    <Text style={styles.statLabel}>Finalizadas</Text>
                </View>
            </View>

            <FlatList
                data={pedidos}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <PedidoCard pedido={item} onPress={() => handlePedidoPress(item)} />
                )}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={loading ? null : renderEmpty}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#1976d2']}
                        tintColor="#1976d2"
                    />
                }
            />

            <TouchableOpacity style={styles.historicoButton} onPress={toggleFinalizados}>
                <Ionicons name={showFinalizados ? "chevron-down" : "chevron-up"} size={24} color="#fff" />
                <Text style={styles.historicoButtonText}>
                    {showFinalizados ? 'Ocultar' : 'Ver'} Histórico ({totalFinalizados})
                </Text>
            </TouchableOpacity>

            {showFinalizados && (
                <View style={styles.finalizadosContainer}>
                    <View style={styles.finalizadosHeader}>
                        <Ionicons name="checkmark-done" size={20} color="#4caf50" />
                        <Text style={styles.finalizadosTitle}>Histórico de Entregas</Text>
                    </View>
                    {loadingFinalizados && pedidosFinalizados.length === 0 ? (
                        <ActivityIndicator style={styles.loadingContainer} color="#1976d2" />
                    ) : pedidosFinalizados.length === 0 ? (
                        <View style={styles.emptyFinalizadosContainer}>
                            <Text style={styles.emptyFinalizadosText}>Nenhuma entrega finalizada ainda</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={pedidosFinalizados}
                            keyExtractor={(item) => `finalizado-${item.id}`}
                            renderItem={renderPedidoFinalizadoCard}
                            contentContainerStyle={styles.finalizadosListContent}
                            ListFooterComponent={renderFooterFinalizados}
                            onEndReached={handleLoadMoreFinalizados}
                            onEndReachedThreshold={0.5}
                            showsVerticalScrollIndicator={true}
                        />
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
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
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#e3f2fd',
        marginTop: 4,
    },
    logoutButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -10,
        marginBottom: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statBox: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#f0f0f0',
    },
    statBoxLast: {
        borderRightWidth: 0,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    loadingFooter: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    historicoButton: {
        position: 'absolute',
        bottom: Platform.OS === 'android' ? 40 : 0,
        left: 0,
        right: 0,
        backgroundColor: '#1976d2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: Platform.OS === 'android' ? 15 : 14,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    historicoButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    finalizadosContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'android' ? 91: 56,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        height: '60%',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    finalizadosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    finalizadosTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    finalizadosListContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyFinalizadosContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyFinalizadosText: {
        fontSize: 14,
        color: '#999',
    },
    finalizadoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 3,
        borderLeftColor: '#4caf50',
    },
    finalizadoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    finalizadoId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    finalizadoCliente: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    finalizadoInfo: {
        gap: 6,
    },
    finalizadoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    finalizadoText: {
        fontSize: 12,
        color: '#666',
    },
});