import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageService {
    private KEYS = {
        SERVER_URL: '@gestgas:serverUrl',
        TOKEN: '@gestgas:token',
        USER: '@gestgas:user',
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
            await AsyncStorage.multiRemove([
                this.KEYS.TOKEN,
                this.KEYS.USER,
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
}

export const storageService = new StorageService();