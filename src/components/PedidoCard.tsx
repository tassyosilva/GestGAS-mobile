import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pedido } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface Props {
    pedido: Pedido;
    onPress: () => void;
}

const STATUS_COLORS: Record<string, string> = {
    'em_entrega': '#2196f3',
    'entregue': '#4caf50',
    'pendente': '#ff9800',
    'cancelado': '#f44336',
};

const STATUS_LABELS: Record<string, string> = {
    'em_entrega': 'Em Entrega',
    'entregue': 'Entregue',
    'pendente': 'Pendente',
    'cancelado': 'Cancelado',
};

export default function PedidoCard({ pedido, onPress }: Props) {
    const statusColor = STATUS_COLORS[pedido.status] || '#999';
    const statusLabel = STATUS_LABELS[pedido.status] || pedido.status;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.clienteInfo}>
                    <Ionicons name="person-outline" size={18} color="#1976d2" />
                    <Text style={styles.clienteNome} numberOfLines={1}>
                        {pedido.cliente.nome}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText} numberOfLines={2}>
                        {pedido.endereco_entrega}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{pedido.cliente.telefone}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{formatDate(pedido.criado_em)}</Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.valorContainer}>
                    <Text style={styles.valorLabel}>Valor Total:</Text>
                    <Text style={styles.valorText}>{formatCurrency(pedido.valor_total)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#1976d2" />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    clienteInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    clienteNome: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 6,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    cardBody: {
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    valorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    valorLabel: {
        fontSize: 14,
        color: '#666',
        marginRight: 6,
    },
    valorText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976d2',
    },
});