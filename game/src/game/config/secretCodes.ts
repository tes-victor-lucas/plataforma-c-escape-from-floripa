export const ROOM1_CLEAR_CODE = '9090';

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
