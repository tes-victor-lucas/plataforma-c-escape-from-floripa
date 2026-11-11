import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { formatBalance, WALLET_UI } from '../config/ticen';
import { bindGamepadActions } from '../input/GamepadInput';

export type WalletMenuData = {
    /** Pontuação atual da partida, mostrada como saldo do cartão. */
    balance: number;
    onUse: () => void;
    onCancel: () => void;
};

const FONT = 'PixelGamer, monospace';

type Button = { label: Phaser.GameObjects.Text; box: Phaser.GameObjects.Rectangle; action: () => void };

/** Carteira aberta na catraca do TICEN: escolher o cartão, ver o saldo e passar na catraca. */
export class WalletMenu extends Scene {
    private menuData!: WalletMenuData;
    private phase: 'carteira' | 'cartao' | 'fechando' = 'carteira';
    private wallet!: Phaser.GameObjects.Image;
    private hint!: Phaser.GameObjects.Text;
    private buttons: Button[] = [];
    private selected = 0;

    constructor() {
        super('WalletMenu');
    }

    create(data: WalletMenuData) {
        this.menuData = data;
        this.phase = 'carteira';
        this.buttons = [];
        this.selected = 0;
        const { walletTexture, scale, cardInWallet } = WALLET_UI;
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 0.78).setOrigin(0);
        this.text(GAME_WIDTH / 2, 44, 'CARTEIRA', 26, '#f0c070');
        this.wallet = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, walletTexture).setScale(scale);
        this.hint = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 34, 'ESCOLHA O CARTÃO DE ÔNIBUS', 16, '#ffffff');

        // Área clicável e contorno pulsando sobre o cartão no bolso.
        const left = this.wallet.x - this.wallet.displayWidth / 2;
        const top = this.wallet.y - this.wallet.displayHeight / 2;
        const card = this.add.rectangle(
            left + (cardInWallet.x + cardInWallet.width / 2) * scale,
            top + (cardInWallet.y + cardInWallet.height / 2) * scale,
            cardInWallet.width * scale + 8,
            cardInWallet.height * scale + 8
        ).setStrokeStyle(3, 0xffd25a).setInteractive({ useHandCursor: true });
        this.tweens.add({ targets: card, alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });
        card.on('pointerdown', () => this.selectCard(card));

        const confirm = () => {
            if (this.phase === 'carteira') this.selectCard(card);
            else if (this.phase === 'cartao') this.buttons[this.selected]?.action();
        };
        const move = (step: number) => () => {
            if (this.phase !== 'cartao') return;
            this.selected = (this.selected + step + this.buttons.length) % this.buttons.length;
            this.renderButtons();
        };
        const keyboard = this.input.keyboard;
        keyboard?.on('keydown-ENTER', confirm);
        keyboard?.on('keydown-SPACE', confirm);
        keyboard?.on('keydown-ESC', () => this.close(false));
        keyboard?.on('keydown-UP', move(-1));
        keyboard?.on('keydown-W', move(-1));
        keyboard?.on('keydown-DOWN', move(1));
        keyboard?.on('keydown-S', move(1));
        bindGamepadActions(this, { confirm, cancel: () => this.close(false), up: move(-1), down: move(1) });
    }

    /** O cartão sai do bolso e cresce à esquerda; o saldo aparece ao lado. */
    private selectCard(slot: Phaser.GameObjects.Rectangle) {
        if (this.phase !== 'carteira') return;
        this.phase = 'cartao';
        slot.destroy();
        this.hint.setText('PASSE O CARTÃO NA CATRACA PARA ENTRAR NO TICEN');
        this.tweens.add({ targets: this.wallet, alpha: 0.18, duration: 220 });
        const { cardTexture, scale } = WALLET_UI;
        const card = this.add.image(slot.x, slot.y, cardTexture).setScale(1.5);
        this.tweens.add({ targets: card, x: 300, y: 236, scale, duration: 320, ease: 'Back.Out' });

        const panelX = 670;
        this.text(panelX, 150, 'SALDO', 18, '#aaa5b8');
        this.text(panelX, 190, formatBalance(this.menuData.balance), 30, '#6fd36f');
        this.text(panelX, 226, 'PONTUAÇÃO DA PARTIDA', 12, '#aaa5b8');
        this.addButton(panelX, 300, 'USAR NA CATRACA', () => this.close(true));
        this.addButton(panelX, 356, 'VOLTAR', () => this.close(false));
        this.renderButtons();
    }

    private addButton(x: number, y: number, label: string, action: () => void) {
        const box = this.add.rectangle(x, y, 250, 42, 0x2a1a10).setInteractive({ useHandCursor: true });
        const text = this.text(x, y, label, 16, '#ffffff');
        const index = this.buttons.length;
        box.on('pointerover', () => {
            this.selected = index;
            this.renderButtons();
        });
        box.on('pointerdown', action);
        this.buttons.push({ label: text, box, action });
    }

    private renderButtons() {
        this.buttons.forEach(({ box, label }, index) => {
            const active = index === this.selected;
            box.setStrokeStyle(3, active ? 0xffd25a : 0x8a5a36).setFillStyle(active ? 0x5a3418 : 0x2a1a10);
            label.setColor(active ? '#ffd25a' : '#ffffff');
        });
    }

    private close(useCard: boolean) {
        if (this.phase === 'fechando') return;
        this.phase = 'fechando';
        this.scene.stop();
        if (useCard) this.menuData.onUse();
        else this.menuData.onCancel();
    }

    private text(x: number, y: number, value: string, size: number, color: string) {
        return this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
            .setOrigin(0.5)
            .setResolution(2);
    }
}
