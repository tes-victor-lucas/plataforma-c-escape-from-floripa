import { FAIR, type FairCreditResult } from '../config/fair';

export type GoogleUser = Readonly<{ name: string; token: string; expiresAt: number }>;

/** Parte usada do Google Identity Services, carregado pelo index.html. */
type GoogleIdApi = {
    initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
    renderButton(parent: HTMLElement, options: Record<string, string>): void;
    prompt(): void;
    cancel(): void;
    disableAutoSelect(): void;
};

const getApi = () => (globalThis as typeof globalThis & { google?: { accounts?: { id?: GoogleIdApi } } }).google?.accounts?.id;

/** Lê o nome e a validade do ID token do Google. A assinatura quem confere são os servidores (placar e feira). */
export function decodeIdToken(token: string): GoogleUser | undefined {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
        const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        if (typeof claims.exp !== 'number') return undefined;
        const name = claims.given_name || claims.name || claims.email || 'Jogador';
        return { name: String(name), token, expiresAt: claims.exp * 1000 };
    } catch {
        return undefined;
    }
}

/** Paga os tijolinhos da feira a quem terminou o jogo; a feira recusa créditos seguidos com 429. */
export async function creditFair(token: string, fetcher: typeof fetch = fetch): Promise<FairCreditResult> {
    try {
        const response = await fetcher(FAIR.creditUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ product: FAIR.product, value: FAIR.value })
        });
        if (response.status === 201) return 'PAID';
        return response.status === 429 ? 'RECENT' : 'FAILED';
    } catch {
        return 'FAILED';
    }
}

export class GoogleAuth {
    // Só na memória: os computadores da feira são compartilhados, e recarregar a página encerra a sessão.
    private current?: GoogleUser;
    private pending?: Promise<GoogleUser | undefined>;

    constructor(private readonly now: () => number = Date.now) {}

    /** Sem a biblioteca do Google (offline ou bloqueada) o jogo segue sem login. */
    get isAvailable() {
        return Boolean(getApi());
    }

    /** Usuário com token ainda válido; o ID token do Google dura 1 hora. */
    get user() {
        return this.current && this.current.expiresAt > this.now() ? this.current : undefined;
    }

    /** Quem entrou e ficou com o token vencido entra de novo; quem joga sem login continua sem. */
    async freshUser() {
        return this.user ?? (this.current ? this.signIn() : undefined);
    }

    accept(credential: string | undefined) {
        this.current = credential ? decodeIdToken(credential) : undefined;
        return this.current;
    }

    signOut() {
        this.current = undefined;
        getApi()?.disableAutoSelect();
    }

    /** Mostra o botão oficial do Google por cima do jogo; resolve sem usuário se a pessoa cancelar. */
    signIn(): Promise<GoogleUser | undefined> {
        const api = getApi();
        if (!api || typeof document === 'undefined') return Promise.resolve(undefined);
        // O controle e outros atalhos ainda chegam ao menu por baixo: um pedido em aberto não abre outro painel.
        this.pending ??= new Promise<GoogleUser | undefined>((resolve) => {
            const overlay = document.createElement('div');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Entrar com Google');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-content:center;gap:16px;'
                + 'justify-items:center;background:rgba(8,8,13,.86)';
            const button = document.createElement('div');
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'CANCELAR';
            cancel.style.cssText = 'font:16px PixelGamer,monospace;color:#b9dce1;background:none;border:1px solid #b9dce1;'
                + 'padding:8px 20px;cursor:pointer';
            overlay.append(button, cancel);

            const finish = (user?: GoogleUser) => {
                document.removeEventListener('keydown', onKey, true);
                api.cancel();
                overlay.remove();
                this.pending = undefined;
                resolve(user);
            };
            // Na captura e sem propagar: a tecla não pode também mexer no menu do jogo que está embaixo.
            const onKey = (event: KeyboardEvent) => {
                event.stopPropagation();
                if (event.key === 'Escape') finish();
            };
            cancel.addEventListener('click', () => finish());
            document.addEventListener('keydown', onKey, true);
            // Em tela cheia só aparece o que está dentro do elemento em tela cheia.
            (document.fullscreenElement ?? document.body).append(overlay);
            api.initialize({ client_id: FAIR.googleClientId, callback: ({ credential }) => finish(this.accept(credential)) });
            api.renderButton(button, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'pt-BR' });
            api.prompt();
            cancel.focus();
        });
        return this.pending;
    }
}

export const googleAuth = new GoogleAuth();

/** Vitória: quem jogou logado recebe o crédito da feira e a frase do resultado; sem login não há o que mostrar. */
export async function payFairCredit(auth: GoogleAuth = googleAuth, fetcher?: typeof fetch) {
    const user = await auth.freshUser();
    return user ? FAIR.messages[await creditFair(user.token, fetcher)] : undefined;
}
