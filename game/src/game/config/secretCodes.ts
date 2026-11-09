export const ROOM_CLEAR_CODE = '9090';
/** Atalho de teste: na Sala III, dá uma carta forte aleatória. */
export const ROOM3_CARD_CODE = '8080';

/** Mantém somente o trecho necessário para reconhecer uma sequência secreta. */
export class SecretCodeMatcher {
    private buffer = '';

    constructor(private readonly code: string) {}

    push(key: string) {
        if (key.length !== 1) return false;

        this.buffer = `${this.buffer}${key}`.slice(-this.code.length);
        if (this.buffer !== this.code) return false;

        this.buffer = '';
        return true;
    }

    reset() {
        this.buffer = '';
    }
}
