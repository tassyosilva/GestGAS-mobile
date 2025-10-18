import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pedidosService } from '../services/pedidoService';

interface CascoOpcao {
    id: number;
    nome: string;
    grupo_nome: string;
    selecionado: boolean;
}

interface Props {
    visible: boolean;
    pedidoId: number;
    gruposComRetorno: Map<number, any[]>;
    onConfirm: (cascosSelecionados: number[]) => void;
    onCancel: () => void;
}

export default function SelecionarCascosModal({
    visible,
    pedidoId,
    gruposComRetorno,
    onConfirm,
    onCancel,
}: Props) {
    const [cascos, setCascos] = useState<CascoOpcao[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && gruposComRetorno.size > 0) {
            carregarCascos();
        }
    }, [visible, pedidoId]);

    const carregarCascos = async () => {
        setLoading(true);
        console.log('Carregando cascos para grupos:', gruposComRetorno);

        try {
            const todasOpcoes: CascoOpcao[] = [];

            // Para cada grupo com produtos retornáveis
            for (const [grupoId, produtos] of gruposComRetorno.entries()) {
                console.log(`Buscando cascos do grupo ${grupoId}`);

                // Buscar cascos deste grupo
                const cascosDoGrupo = await pedidosService.buscarCascosDoGrupo(grupoId);

                console.log(`Cascos encontrados para grupo ${grupoId}:`, cascosDoGrupo);

                // Adicionar cada casco como opção
                for (const casco of cascosDoGrupo) {
                    todasOpcoes.push({
                        id: casco.id || casco.produto_id,
                        nome: casco.nome || casco.produto_nome,
                        grupo_nome: produtos[0]?.grupo_nome || `Grupo ${grupoId}`,
                        selecionado: false,
                    });
                }
            }

            console.log('Total de opções de cascos:', todasOpcoes);
            setCascos(todasOpcoes);
        } catch (error) {
            console.error('Erro ao carregar cascos:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCasco = (cascoId: number) => {
        setCascos((prev) =>
            prev.map((c) =>
                c.id === cascoId ? { ...c, selecionado: !c.selecionado } : c
            )
        );
    };

    const handleConfirm = () => {
        const selecionados = cascos
            .filter((c) => c.selecionado)
            .map((c) => c.id);

        console.log('Cascos selecionados:', selecionados);
        onConfirm(selecionados);
    };

    const cascosSelecionados = cascos.filter((c) => c.selecionado).length;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Selecionar Cascos Retornados</Text>
                        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Selecione quais cascos/botijas vazias o cliente devolveu
                    </Text>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1976d2" />
                            <Text style={styles.loadingText}>Carregando opções...</Text>
                        </View>
                    ) : (
                        <>
                            <ScrollView style={styles.scrollView}>
                                {cascos.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="information-circle" size={48} color="#ccc" />
                                        <Text style={styles.emptyText}>
                                            Nenhum casco retornável encontrado neste pedido
                                        </Text>
                                    </View>
                                ) : (
                                    cascos.map((casco) => (
                                        <TouchableOpacity
                                            key={casco.id}
                                            style={[
                                                styles.cascoItem,
                                                casco.selecionado && styles.cascoItemSelecionado,
                                            ]}
                                            onPress={() => toggleCasco(casco.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.cascoInfo}>
                                                <Text style={styles.cascoNome}>{casco.nome}</Text>
                                                <Text style={styles.cascoGrupo}>{casco.grupo_nome}</Text>
                                            </View>
                                            <View
                                                style={[
                                                    styles.checkbox,
                                                    casco.selecionado && styles.checkboxSelecionado,
                                                ]}
                                            >
                                                {casco.selecionado && (
                                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    {cascosSelecionados} casco(s) selecionado(s)
                                </Text>
                                <View style={styles.footerButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={onCancel}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.confirmButton,
                                            cascosSelecionados === 0 && styles.confirmButtonDisabled,
                                        ]}
                                        onPress={handleConfirm}
                                        disabled={cascosSelecionados === 0}
                                    >
                                        <Text style={styles.confirmButtonText}>
                                            Confirmar Entrega
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        padding: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    scrollView: {
        maxHeight: 400,
        paddingHorizontal: 16,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
        marginTop: 12,
        textAlign: 'center',
    },
    cascoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cascoItemSelecionado: {
        backgroundColor: '#e3f2fd',
        borderColor: '#1976d2',
    },
    cascoInfo: {
        flex: 1,
        marginRight: 12,
    },
    cascoNome: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    cascoGrupo: {
        fontSize: 13,
        color: '#666',
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelecionado: {
        backgroundColor: '#1976d2',
        borderColor: '#1976d2',
    },
    footer: {
        padding: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
        textAlign: 'center',
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    confirmButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#4caf50',
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.5,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});