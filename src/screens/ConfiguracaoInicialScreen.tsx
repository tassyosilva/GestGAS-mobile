import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { authService } from '../services/authService';
import axios from 'axios';

interface Props {
    onConfigComplete: () => void;
}

export default function ConfiguracaoInicialScreen({ onConfigComplete }: Props) {
    const [serverUrl, setServerUrl] = useState('');
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);

    const testConnection = async () => {
        if (!serverUrl) {
            Alert.alert('Erro', 'Digite o endereço do servidor');
            return;
        }

        setTestingConnection(true);

        try {
            const url = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;

            // Tentar uma requisição simples
            await axios.get(`${url}/api/health`, { timeout: 5000 });

            Alert.alert('Sucesso', 'Conexão com o servidor estabelecida!');
        } catch (error: any) {
            console.error('Erro ao testar conexão:', error);
            Alert.alert(
                'Erro de Conexão',
                'Não foi possível conectar ao servidor. Verifique o endereço e sua conexão com a internet.'
            );
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSubmit = async () => {
        if (!serverUrl || !login || !senha) {
            Alert.alert('Erro', 'Preencha todos os campos');
            return;
        }

        setLoading(true);

        try {
            const normalizedUrl = serverUrl.endsWith('/')
                ? serverUrl.slice(0, -1)
                : serverUrl;

            // Fazer login
            const response = await authService.login(normalizedUrl, login, senha);

            // Verificar se é entregador
            if (response.perfil !== 'entregador') {
                Alert.alert(
                    'Acesso Negado',
                    'Apenas usuários com perfil de entregador podem usar este aplicativo'
                );
                setLoading(false);
                return;
            }

            // Salvar dados
            await authService.saveAuthData(normalizedUrl, response);

            // Notificar conclusão
            onConfigComplete();
        } catch (error: any) {
            console.error('Erro ao configurar:', error);

            let errorMessage = 'Erro ao conectar com o servidor';

            if (error.response?.status === 401) {
                errorMessage = 'Login ou senha inválidos';
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                errorMessage = 'Tempo de conexão esgotado. Verifique sua internet.';
            } else if (error.message.includes('Network Error')) {
                errorMessage = 'Erro de rede. Verifique sua conexão.';
            }

            Alert.alert('Erro', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Configuração Inicial</Text>
                    <Text style={styles.subtitle}>Configure o acesso ao sistema</Text>
                </View>

                <View style={styles.form}>
                    {/* URL do Servidor */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Endereço do Servidor</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://seuservidor.com"
                            value={serverUrl}
                            onChangeText={setServerUrl}
                            autoCapitalize="none"
                            keyboardType="url"
                            editable={!loading}
                        />
                        <TouchableOpacity
                            style={[styles.testButton, testingConnection && styles.buttonDisabled]}
                            onPress={testConnection}
                            disabled={testingConnection || !serverUrl}
                        >
                            {testingConnection ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.testButtonText}>Testar Conexão</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Login */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Login</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Digite seu login"
                            value={login}
                            onChangeText={setLogin}
                            autoCapitalize="none"
                            editable={!loading}
                        />
                    </View>

                    {/* Senha */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Senha</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Digite sua senha"
                            value={senha}
                            onChangeText={setSenha}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    {/* Botão de Submit */}
                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading || !serverUrl || !login || !senha}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Conectar e Salvar</Text>
                        )}
                    </TouchableOpacity>

                    {/* Informações */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            💡 O endereço do servidor deve incluir http:// ou https://
                        </Text>
                        <Text style={styles.infoText}>
                            📱 Teste a conexão antes de salvar as configurações
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1976d2',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    form: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    testButton: {
        backgroundColor: '#64b5f6',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
        alignItems: 'center',
    },
    testButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#1976d2',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    infoBox: {
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        padding: 12,
        marginTop: 20,
    },
    infoText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 6,
    },
});