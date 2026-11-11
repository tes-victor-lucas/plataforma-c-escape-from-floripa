import type { Scene } from 'phaser';
import { CHARACTERS, type CharacterId } from '../config/characters';
import { GAME_WIDTH } from '../config/display';
import { WALK_FRAMES } from '../entities/PlayerAnimations';
import type { UpgradeProgress } from '../upgrades/types';
import { CLEAN_MENU_COLORS, CleanOverlayMenu, drawCleanMenuBox } from './CleanOverlayMenu';
import { addUpgradePanel } from './PauseMenuView';

/** Item guardado nos recursos; cada item novo (chapéu, bota...) entra nesta lista quando for implementado. */
export type ResourceItem = Readonly<{ name: string; texture: string; description: string }>;

export type ResourcesData = Readonly<{
    chimarraos: number;
    characterId: CharacterId;
    items: readonly ResourceItem[];
}>;

type ResourcesMenuViewOptions = ResourcesData & Readonly<{
    upgrades: UpgradeProgress;
    onBack: () => void;
}>;

const FONT = 'PixelGamer, monospace';
const PANEL = { x: 16, y: 14, width: 857, height: 472 };
const CARDS = { x: 36, y: 66, width: 174, height: 300 };
const CHIMARRAO = { x: 36, y: 378, width: 174, height: 50 };
const DOLL = { x: 232, y: 66, width: 200, height: 220 };
const DETAILS = { x: 610, y: 66, width: 243, height: 220 };
// Encaixes do boneco: vazios até os itens de equipar chegarem.
const EQUIPMENT_SLOTS = ['CABEÇA', 'CORPO', 'MÃOS', 'PÉS'] as const;
const SLOT = 44;
const GRID = { x: 232, y: 308, columns: 12, rows: 2, gap: 6 };

/** Tela de recursos: cartas e chimarrões à esquerda, boneco com equipamentos e os itens guardados. */
export class ResourcesMenuView {
    private selectedItem = 0;
    private itemSlots: Phaser.GameObjects.Rectangle[] = [];
    private detailTitle?: Phaser.GameObjects.Text;
    private detailText?: Phaser.GameObjects.Text;

    constructor(
        private readonly scene: Scene,
        private readonly options: ResourcesMenuViewOptions
    ) {}

    create() {
        const menu = new CleanOverlayMenu(this.scene, { bounds: PANEL, dimAlpha: 0.78 });
        menu.add(this.text(GAME_WIDTH / 2, 40, 'RECURSOS', 26, CLEAN_MENU_COLORS.text).setOrigin(0.5));
        addUpgradePanel(this.scene, menu, this.options.upgrades, CARDS);
        this.addChimarraos(menu);
        this.addDoll(menu);
        this.addEquipmentSlots(menu);
        this.addDetails(menu);
        this.addItemGrid(menu);
        menu.addButton('VOLTAR', 446, this.options.onBack, { width: 220, height: 38, fontSize: '19px' });
        menu.enableKeyboardNavigation({ onCancel: this.options.onBack });
        menu.fadeIn();
    }

    private addChimarraos(menu: CleanOverlayMenu) {
        const box = this.box(CHIMARRAO);
        const centerY = CHIMARRAO.y + CHIMARRAO.height / 2;
        const icon = this.scene.add.image(CHIMARRAO.x + 26, centerY, 'chimarrao');
        icon.setScale(28 / Math.max(icon.width, icon.height));
        menu.add([
            box,
            icon,
            this.text(CHIMARRAO.x + 48, centerY - 9, 'CHIMARRÕES', 11, CLEAN_MENU_COLORS.mutedText),
            this.text(CHIMARRAO.x + 48, centerY + 7, `${this.options.chimarraos}`, 18, CLEAN_MENU_COLORS.text)
        ]);
    }

    private addDoll(menu: CleanOverlayMenu) {
        const grid = this.box(DOLL);
        grid.lineStyle(1, CLEAN_MENU_COLORS.frame, 0.12);
        for (let x = DOLL.x + 12; x < DOLL.x + DOLL.width; x += 12) grid.lineBetween(x, DOLL.y + 4, x, DOLL.y + DOLL.height - 4);
        for (let y = DOLL.y + 12; y < DOLL.y + DOLL.height; y += 12) grid.lineBetween(DOLL.x + 4, y, DOLL.x + DOLL.width - 4, y);
        const character = CHARACTERS[this.options.characterId];
        // De frente e parado, ampliado: os itens equipados vão aparecer por cima dele.
        const doll = this.scene.add.image(DOLL.x + DOLL.width / 2, DOLL.y + DOLL.height / 2 + 6, character.texture, WALK_FRAMES.down[0])
            .setScale(4.5 * character.scaleMultiplier);
        menu.add([grid, doll, this.text(DOLL.x + DOLL.width / 2, DOLL.y + DOLL.height - 16, character.label, 12, CLEAN_MENU_COLORS.frameCss).setOrigin(0.5)]);
    }

    private addEquipmentSlots(menu: CleanOverlayMenu) {
        EQUIPMENT_SLOTS.forEach((label, index) => {
            const y = DOLL.y + 14 + index * 52;
            const x = DOLL.x + DOLL.width + 26;
            const slot = this.scene.add.rectangle(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT, CLEAN_MENU_COLORS.button)
                .setStrokeStyle(1, CLEAN_MENU_COLORS.frame, 0.6);
            menu.add([
                slot,
                this.text(x + SLOT + 10, y + 12, label, 12, CLEAN_MENU_COLORS.text),
                this.text(x + SLOT + 10, y + 28, 'VAZIO', 10, CLEAN_MENU_COLORS.mutedText)
            ]);
        });
    }

    private addDetails(menu: CleanOverlayMenu) {
        this.detailTitle = this.text(DETAILS.x + 16, DETAILS.y + 18, '', 15, CLEAN_MENU_COLORS.text);
        this.detailText = this.scene.add.text(DETAILS.x + 16, DETAILS.y + 48, '', {
            fontFamily: FONT,
            fontSize: '11px',
            color: CLEAN_MENU_COLORS.mutedText,
            lineSpacing: 6,
            wordWrap: { width: DETAILS.width - 32, useAdvancedWrap: true }
        }).setResolution(2);
        menu.add([this.box(DETAILS), this.detailTitle, this.detailText]);
    }

    private addItemGrid(menu: CleanOverlayMenu) {
        const { items } = this.options;
        this.itemSlots = [];
        for (let index = 0; index < GRID.columns * GRID.rows; index += 1) {
            const x = GRID.x + (index % GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const y = GRID.y + Math.floor(index / GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const slot = this.scene.add.rectangle(x, y, SLOT, SLOT, CLEAN_MENU_COLORS.button);
            menu.add(slot);
            const item = items[index];
            if (!item) {
                slot.setStrokeStyle(1, CLEAN_MENU_COLORS.frame, 0.35);
                continue;
            }
            const icon = this.scene.add.image(x, y, item.texture);
            icon.setScale((SLOT - 8) / Math.max(icon.width, icon.height));
            slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectItem(index));
            menu.add(icon);
            this.itemSlots[index] = slot;
        }
        this.selectItem(0);
    }

    private selectItem(index: number) {
        const item = this.options.items[index];
        this.selectedItem = item ? index : this.selectedItem;
        this.itemSlots.forEach((slot, slotIndex) => slot?.setStrokeStyle(
            slotIndex === this.selectedItem ? 3 : 1,
            slotIndex === this.selectedItem ? CLEAN_MENU_COLORS.danger : CLEAN_MENU_COLORS.frame
        ));
        const selected = this.options.items[this.selectedItem];
        this.detailTitle?.setText(selected?.name ?? 'NENHUM ITEM');
        this.detailText?.setText(selected?.description ?? 'OS ITENS PEGOS PELO MAPA FICAM GUARDADOS AQUI.');
    }

    private box(bounds: Readonly<{ x: number; y: number; width: number; height: number }>) {
        const graphics = this.scene.add.graphics();
        drawCleanMenuBox(graphics, bounds, CLEAN_MENU_COLORS.panel, CLEAN_MENU_COLORS.frame, 6, 2);
        return graphics;
    }

    private text(x: number, y: number, value: string, size: number, color: string) {
        return this.scene.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color })
            .setOrigin(0, 0.5)
            .setResolution(2);
    }
}
