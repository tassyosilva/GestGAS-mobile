export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const formatTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const calcularTempoEntrega = (dataAtribuicao?: string, dataEntrega?: string): string => {
    if (!dataAtribuicao || !dataEntrega) return '-';

    const inicio = new Date(dataAtribuicao);
    const fim = new Date(dataEntrega);

    const diffMs = fim.getTime() - inicio.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));

    if (diffMinutos < 60) {
        return `${diffMinutos} min`;
    } else {
        const horas = Math.floor(diffMinutos / 60);
        const minutos = diffMinutos % 60;
        if (minutos === 0) {
            return `${horas}h`;
        } else {
            return `${horas}h ${minutos}min`;
        }
    }
};

export const formatShortDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const calcularTempoEspera = (dataCriacao: string): string => {
    if (!dataCriacao) return '-';

    const agora = new Date();
    const criacao = new Date(dataCriacao);

    const diffMs = agora.getTime() - criacao.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));

    if (diffMinutos < 1) {
        return 'Agora';
    } else if (diffMinutos < 60) {
        return `Aguardando há ${diffMinutos} min`;
    } else {
        const horas = Math.floor(diffMinutos / 60);
        const minutos = diffMinutos % 60;
        if (minutos === 0) {
            return `Aguardando há ${horas}h`;
        } else {
            return `Aguardando há ${horas}h ${minutos}min`;
        }
    }
};