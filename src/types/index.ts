export interface Usuario {
    id: number;
    nome: string;
    login: string;
    perfil: string;
}

export interface LoginResponse {
    id: number;
    nome: string;
    login: string;
    perfil: string;
    token: string;
}

export interface Cliente {
    id: number;
    nome: string;
    telefone: string;
}

export interface ItemPedido {
    id?: number;
    produto_id?: number;
    nome_produto?: string;
    quantidade?: number;
    preco_unitario?: number;
    valor_unitario?: number;
    subtotal?: number;
    retorna_botija: boolean;
}

export interface Pedido {
    id: number;
    cliente: Cliente;
    status: string;
    valor_total: number;
    endereco_entrega: string;
    criado_em: string;
    itens?: ItemPedido[];
}

export interface PedidoDetalhes extends Pedido {
    itens: ItemPedido[];
}

export interface AppConfig {
    serverUrl: string | null;
    token: string | null;
    user: Usuario | null;
}