import axios, { AxiosInstance } from 'axios';
import { authService } from './authService';
import { API_TIMEOUT } from '../config/api';

class ApiService {
    private instance: AxiosInstance;

    constructor() {
        this.instance = axios.create({
            timeout: API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // Request interceptor
        this.instance.interceptors.request.use(
            async (config) => {
                // Adicionar base URL
                const baseUrl = await authService.getApiBaseUrl();
                if (config.url && !config.url.startsWith('http')) {
                    config.url = `${baseUrl}${config.url}`;
                }

                // Adicionar token
                const token = await authService.getToken();
                if (token && config.headers) {
                    // Verificar se token está expirado
                    if (!authService.isTokenExpired(token)) {
                        config.headers.Authorization = `Bearer ${token}`;
                    } else {
                        // Token expirado, fazer logout
                        await authService.logout();
                        throw new Error('Sessão expirada');
                    }
                }

                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.instance.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    // Não autorizado - fazer logout
                    await authService.logout();
                }
                return Promise.reject(error);
            }
        );
    }

    getAxiosInstance(): AxiosInstance {
        return this.instance;
    }
}

export const apiService = new ApiService();
export const api = apiService.getAxiosInstance();