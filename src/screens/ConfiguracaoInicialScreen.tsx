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

    const validarUrl = (url: string): { valida: boolean; mensagem: string } => {
        if (!url || url.trim().length === 0) {
            return { valida: false, mensagem: 'Digite o endereço do servidor' };
        }

        // Verificar se começa com http:// ou https://
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return { valida: false, mensagem: 'A URL deve começar com http:// ou https://' };
        }

        // Validar formato básico de URL
        try {
            new URL(url);
            return { valida: true, mensagem: '' };
        } catch (error) {
            return { valida: false, mensagem: 'URL inválida. Verifique o formato do endereço' };
        }
    };

    const testConnection = async () => {
        // Validar URL primeiro
        const validacao = validarUrl(serverUrl);
        if (!validacao.valida) {
            Alert.alert('Erro', validacao.mensagem);
            return;
        }

        setTestingConnection(true);

        try {
            const url = serverUrl.trim().endsWith('/') ? serverUrl.trim().slice(0, -1) : serverUrl.trim();

            console.log('Testando conexão com:', url);

            // Tentar requisição ao endpoint de health
            const response = await axios.get(`${url}/api/health`, {
                timeout: 5000,
                validateStatus: (status) => status < 500 // Aceitar respostas < 500
            });

            console.log('Resposta do servidor:', response.status);

            if (response.status === 200 || response.status === 404) {
                // 404 significa que o servidor respondeu, mas o endpoint não existe
                Alert.alert('Sucesso', 'Conexão com o servidor estabelecida!');
            } else {
                Alert.alert('Aviso', `Servidor respondeu com status ${response.status}. Você pode tentar fazer login.`);
            }
        } catch (error: any) {
            console.error('Erro ao testar conexão:', error);

            let errorMessage = 'Não foi possível conectar ao servidor.';

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                errorMessage = 'Tempo de conexão esgotado. Verifique o endereço e sua internet.';
            } else if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
                errorMessage = 'Erro de rede. Verifique sua conexão com a internet.';
            } else if (error.message?.includes('ENOTFOUND')) {
                errorMessage = 'Servidor não encontrado. Verifique se o endereço está correto.';
            } else if (error.response) {
                errorMessage = `Servidor respondeu com erro ${error.response.status}. O servidor pode estar temporariamente indisponível.`;
            }

            Alert.alert('Erro de Conexão', errorMessage);
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSubmit = async () => {
        // Validar campos vazios
        if (!serverUrl || !login || !senha) {
            Alert.alert('Erro', 'Preencha todos os campos');
            return;
        }

        // Validar URL
        const validacao = validarUrl(serverUrl);
        if (!validacao.valida) {
            Alert.alert('Erro', validacao.mensagem);
            return;
        }

        // Validar login e senha não vazios após trim
        if (login.trim().length === 0 || senha.trim().length === 0) {
            Alert.alert('Erro', 'Login e senha não podem conter apenas espaços');
            return;
        }

        setLoading(true);

        try {
            const normalizedUrl = serverUrl.trim().endsWith('/')
                ? serverUrl.trim().slice(0, -1)
                : serverUrl.trim();

            console.log('Tentando login em:', normalizedUrl);

            // Fazer login
            const response = await authService.login(normalizedUrl, login.trim(), senha);

            // Validar resposta do login
            if (!response || typeof response !== 'object') {
                throw new Error('Resposta inválida do servidor');
            }

            if (!response.token || !response.id || !response.nome || !response.perfil) {
                throw new Error('Dados de autenticação incompletos recebidos do servidor');
            }

            console.log('Login bem-sucedido. Perfil:', response.perfil);

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

            console.log('Configuração concluída com sucesso');

            // Notificar conclusão
            onConfigComplete();
        } catch (error: any) {
            console.error('Erro ao configurar:', error);

            let errorMessage = 'Erro ao conectar com o servidor';

            if (error.response?.status === 401) {
                errorMessage = 'Login ou senha inválidos';
            } else if (error.response?.status === 404) {
                errorMessage = 'Endpoint de login não encontrado. Verifique o endereço do servidor.';
            } else if (error.response?.status === 500) {
                errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                errorMessage = 'Tempo de conexão esgotado. Verifique sua internet.';
            } else if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
                errorMessage = 'Erro de rede. Verifique sua conexão.';
            } else if (error.message?.includes('ENOTFOUND')) {
                errorMessage = 'Servidor não encontrado. Verifique o endereço.';
            } else if (error.message === 'Resposta inválida do servidor' || error.message === 'Dados de autenticação incompletos recebidos do servidor') {
                errorMessage = error.message;
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
                            onChangeText={(text) => setServerUrl(text.trim())}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            editable={!loading}
                            returnKeyType="next"
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
                            autoCorrect={false}
                            editable={!loading}
                            returnKeyType="next"
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
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                            returnKeyType="done"
                            onSubmitEditing={handleSubmit}
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