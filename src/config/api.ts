// URL base será dinâmica, configurada pelo usuário
export const API_TIMEOUT = 10000; // 10 segundos

// Endpoints
export const API_ENDPOINTS = {
    LOGIN: '/api/login',
    PEDIDOS: '/api/pedidos',
    CONFIRMAR_ENTREGA: '/api/pedidos/confirmar-entrega',
    REGISTRAR_BOTIJAS: '/api/pedidos/registrar-botijas',
    PEDIDO_DETALHES: (id: number) => `/api/pedidos/${id}`,
};