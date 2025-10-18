import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { storageService } from './storageService';
import { LoginResponse, Usuario } from '../types';
import { API_ENDPOINTS, API_TIMEOUT } from '../config/api';

class AuthService {
    private apiBaseUrl: string | null = null;

    async initialize() {
        const serverUrl = await storageService.getServerUrl();
        if (serverUrl) {
            this.apiBaseUrl = serverUrl;
        }
    }

    async getApiBaseUrl(): Promise<string> {
        if (!this.apiBaseUrl) {
            this.apiBaseUrl = await storageService.getServerUrl();
        }

        if (!this.apiBaseUrl) {
            throw new Error('URL do servidor não configurada');
        }

        return this.apiBaseUrl;
    }

    async login(serverUrl: string, login: string, senha: string): Promise<LoginResponse> {
        try {
            // Normalizar URL
            const normalizedUrl = serverUrl.endsWith('/')
                ? serverUrl.slice(0, -1)
                : serverUrl;

            const response = await axios.post<LoginResponse>(
                `${normalizedUrl}${API_ENDPOINTS.LOGIN}`,
                { login, senha },
                { timeout: API_TIMEOUT }
            );

            return response.data;
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            throw error;
        }
    }

    async saveAuthData(serverUrl: string, data: LoginResponse): Promise<void> {
        try {
            await storageService.setServerUrl(serverUrl);
            await storageService.setToken(data.token);
            await storageService.setUser({
                id: data.id,
                nome: data.nome,
                login: data.login,
                perfil: data.perfil,
            });

            // Atualizar URL base local
            this.apiBaseUrl = serverUrl;
        } catch (error) {
            console.error('Erro ao salvar dados de autenticação:', error);
            throw error;
        }
    }

    async isAuthenticated(): Promise<boolean> {
        try {
            const token = await storageService.getToken();
            if (!token) return false;

            return !this.isTokenExpired(token);
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            return false;
        }
    }

    isTokenExpired(token?: string): boolean {
        if (!token) return true;

        try {
            const decoded: any = jwtDecode(token);
            const currentTime = Date.now() / 1000;
            return decoded.exp < currentTime;
        } catch (error) {
            console.error('Erro ao decodificar token:', error);
            return true;
        }
    }

    async getToken(): Promise<string | null> {
        return await storageService.getToken();
    }

    async getUser(): Promise<Usuario | null> {
        return await storageService.getUser();
    }

    async logout(): Promise<void> {
        try {
            await storageService.clear();
            this.apiBaseUrl = null;
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            throw error;
        }
    }
}

export const authService = new AuthService();