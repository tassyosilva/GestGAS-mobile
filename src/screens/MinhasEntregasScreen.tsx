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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { pedidosService } from '../services/pedidoService';
import { Pedido, Usuario } from '../types';
import PedidoCard from '../components/PedidoCard';

interface Props {
    navigation: any;
    onLogout: () => void;  // Adicionar esta prop
}

export default function MinhasEntregasScreen({ navigation, onLogout }: Props) {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [user, setUser] = useState<Usuario | null>(null);
    const limit = 20;

    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        if (user) {
            loadPedidos();
        }
    }, [user, page]);

    const loadUser = async () => {
        try {
            const userData = await authService.getUser();
            setUser(userData);
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            Alert.alert('Erro', 'Não foi possível carregar dados do usuário');
        }
    };

    const loadPedidos = async () => {
        if (!user) return;

        try {
            setLoading(true);

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
                onLogout(); // Usar callback ao invés de navigation
            } else if (error.message.includes('Network Error')) {
                errorMessage = 'Erro de conexão. Verifique sua internet.';
            }

            Alert.alert('Erro', errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setPage(0);
        loadPedidos();
    }, [user]);

    const handlePedidoPress = (pedido: Pedido) => {
        navigation.navigate('DetalhesPedido', { pedidoId: pedido.id });
    };

    const handleLogout = () => {
        Alert.alert(
            'Sair',
            'Deseja realmente sair?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sair',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authService.logout();
                            onLogout(); // Chamar callback ao invés de navigation.replace
                        } catch (error) {
                            console.error('Erro ao fazer logout:', error);
                            Alert.alert('Erro', 'Não foi possível fazer logout');
                        }
                    },
                },
            ]
        );
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

    const renderFooter = () => {
        if (!loading || pedidos.length === 0) return null;

        return (
            <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="#1976d2" />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Minhas Entregas</Text>
                    {user && (
                        <Text style={styles.headerSubtitle}>{user.nome}</Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={handleLogout}
                    style={styles.logoutButton}
                >
                    <Ionicons name="log-out-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{total}</Text>
                    <Text style={styles.statLabel}>Total de Entregas</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{pedidos.length}</Text>
                    <Text style={styles.statLabel}>Nesta Página</Text>
                </View>
            </View>

            <FlatList
                data={pedidos}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <PedidoCard
                        pedido={item}
                        onPress={() => handlePedidoPress(item)}
                    />
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
        paddingBottom: 20,
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
        paddingVertical: 20,
        alignItems: 'center',
    },
});