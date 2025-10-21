import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

class StorageService {
    private KEYS = {
        SERVER_URL: 'gestgas_serverUrl',
        TOKEN: 'gestgas_token',
        USER: 'gestgas_user',
        CREDENTIALS: 'gestgas_credentials',
        PIN: 'gestgas_pin',
        HAS_PIN: 'gestgas_hasPin',
    };

    async setServerUrl(url: string): Promise<void> {
        try {
            await AsyncStorage.setItem(this.KEYS.SERVER_URL, url);
        } catch (error) {
            console.error('Erro ao salvar URL do servidor:', error);
            throw error;
        }
    }

    async getServerUrl(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(this.KEYS.SERVER_URL);
        } catch (error) {
            console.error('Erro ao obter URL do servidor:', error);
            return null;
        }
    }

    async setToken(token: string): Promise<void> {
        try {
            await AsyncStorage.setItem(this.KEYS.TOKEN, token);
        } catch (error) {
            console.error('Erro ao salvar token:', error);
            throw error;
        }
    }

    async getToken(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(this.KEYS.TOKEN);
        } catch (error) {
            console.error('Erro ao obter token:', error);
            return null;
        }
    }

    async setUser(user: any): Promise<void> {
        try {
            await AsyncStorage.setItem(this.KEYS.USER, JSON.stringify(user));
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            throw error;
        }
    }

    async getUser(): Promise<any | null> {
        try {
            const userStr = await AsyncStorage.getItem(this.KEYS.USER);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Erro ao obter usuário:', error);
            return null;
        }
    }

    async clear(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(this.KEYS.CREDENTIALS);
            await SecureStore.deleteItemAsync(this.KEYS.PIN);
            await AsyncStorage.multiRemove([
                this.KEYS.TOKEN,
                this.KEYS.USER,
                this.KEYS.HAS_PIN,
                // Mantém SERVER_URL para não precisar reconfigurar
            ]);
        } catch (error) {
            console.error('Erro ao limpar storage:', error);
        }
    }

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.clear();
        } catch (error) {
            console.error('Erro ao limpar todo storage:', error);
        }
    }

    async setCredentials(login: string, senha: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(this.KEYS.CREDENTIALS, JSON.stringify({ login, senha }));
        } catch (error) {
            console.error('Erro ao salvar credenciais:', error);
            throw error;
        }
    }

    async getCredentials(): Promise<{ login: string; senha: string } | null> {
        try {
            const credentialsStr = await SecureStore.getItemAsync(this.KEYS.CREDENTIALS);
            return credentialsStr ? JSON.parse(credentialsStr) : null;
        } catch (error) {
            console.error('Erro ao obter credenciais:', error);
            return null;
        }
    }

    async setPin(pin: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(this.KEYS.PIN, pin);
            await AsyncStorage.setItem(this.KEYS.HAS_PIN, 'true');
        } catch (error) {
            console.error('Erro ao salvar PIN:', error);
            throw error;
        }
    }

    async getPin(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(this.KEYS.PIN);
        } catch (error) {
            console.error('Erro ao obter PIN:', error);
            return null;
        }
    }

    async hasPin(): Promise<boolean> {
        try {
            const hasPinStr = await AsyncStorage.getItem(this.KEYS.HAS_PIN);
            return hasPinStr === 'true';
        } catch (error) {
            console.error('Erro ao verificar PIN:', error);
            return false;
        }
    }

    async clearPin(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(this.KEYS.PIN);
            await AsyncStorage.removeItem(this.KEYS.HAS_PIN);
        } catch (error) {
            console.error('Erro ao limpar PIN:', error);
        }
    }
}

export const storageService = new StorageService();