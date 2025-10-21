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
    produto_nome?: string;
    quantidade?: number;
    preco_unitario?: number;
    valor_unitario?: number;
    subtotal?: number;
    retorna_botija: boolean;
    categoria?: string;
    grupo_id?: number;
    grupo_nome?: string;
}

export interface Pedido {
    id: number;
    cliente: Cliente;
    status: string;
    valor_total: number;
    endereco_entrega: string;
    criado_em: string;
    itens?: ItemPedido[];
    forma_pagamento?: string;
    pagamento_realizado?: boolean;
}

export interface PedidoDetalhes extends Pedido {
    itens: ItemPedido[];
    forma_pagamento?: string;
    pagamento_realizado?: boolean;
}

export interface AppConfig {
    serverUrl: string | null;
    token: string | null;
    user: Usuario | null;
}

export interface GrupoBotija {
    id: number;
    nome: string;
    descricao?: string;
}

export interface ProdutoGrupo {
    produto_id: number;
    produto_nome: string;
    grupo_id: number;
    grupo_nome: string;
    categoria: string;
}

export interface CascoDisponivel {
    id: number;
    nome: string;
    categoria: string;
    grupo_id?: number;
    grupo_nome?: string;
    produto_principal_id?: number;
    produto_principal_nome?: string;
}

export interface ConfirmarEntregaRequest {
    pedido_id: number;
    cascos?: CascoSelecionado;
}

export interface CascoSelecionado {
    [produto_id: string]: CascoQuantidade[];
}

export interface CascoQuantidade {
    casco_id: number;
    quantidade: number;
}

export interface PedidoResolvido {
    id: number;
    data_entregador_atribuido?: string;
    data_entrega?: string;
    endereco_entrega: string;
    valor_total: number;
    cliente_nome: string;
    status: string;
    bairro?: string;
    tempo_entrega?: string;
    forma_pagamento?: string;
}