import type { Scene } from 'phaser';
import { CHARACTERS, type CharacterId } from '../config/characters';
import type { EquipmentSlot, ItemId } from '../config/items';
import { ITEMS } from '../config/items';
import { getItemOffsetY } from '../entities/WornItem';
import { GAME_WIDTH } from '../config/display';
import { WALK_FRAMES } from '../entities/PlayerAnimations';
import type { UpgradeProgress } from '../upgrades/types';
import { CLEAN_MENU_COLORS, CleanOverlayMenu, drawCleanMenuBox } from './CleanOverlayMenu';
import { addUpgradePanel } from './PauseMenuView';

/** Item guardado no inventário; cada item novo (chapéu, bota...) entra nesta lista quando for implementado. */
export type InventoryItem = Readonly<{
    name: string;
    texture: string;
    description: string;
    /** Só itens de equipar têm id, encaixe e estado. */
    id?: ItemId;
    slot?: EquipmentSlot;
    equipped?: boolean;
}>;

export type InventoryData = Readonly<{
    chimarraos: number;
    characterId: CharacterId;
    items: readonly InventoryItem[];
    /** Equipa ou retira um item e devolve o inventário como ficou. */
    onToggleItem?: (id: ItemId) => InventoryData;
}>;

type InventoryMenuViewOptions = InventoryData & Readonly<{
    upgrades: UpgradeProgress;
    selectedItem?: number;
    onBack: () => void;
    onToggle?: (id: ItemId, index: number) => void;
}>;

const FONT = 'PixelGamer, monospace';
const PANEL = { x: 16, y: 14, width: 857, height: 472 };
const CARDS = { x: 36, y: 66, width: 174, height: 300 };
const CHIMARRAO = { x: 36, y: 378, width: 174, height: 50 };
const DOLL = { x: 232, y: 66, width: 200, height: 220 };
const DETAILS = { x: 610, y: 66, width: 243, height: 220 };
// Encaixes do boneco; cada item de equipar ocupa o seu.
const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['CABEÇA', 'CORPO', 'MÃOS', 'PÉS'];
const SLOT = 44;
const GRID = { x: 232, y: 308, columns: 12, rows: 2, gap: 6 };

/** Tela de inventário: cartas e chimarrões à esquerda, boneco com equipamentos e os itens guardados. */
export class InventoryMenuView {
    private selectedItem = 0;
    private itemSlots: Phaser.GameObjects.Rectangle[] = [];
    private detailTitle?: Phaser.GameObjects.Text;
    private detailText?: Phaser.GameObjects.Text;
    private toggleButton?: Phaser.GameObjects.Rectangle;
    private toggleLabel?: Phaser.GameObjects.Text;

    constructor(
        private readonly scene: Scene,
        private readonly options: InventoryMenuViewOptions
    ) {}

    create() {
        const menu = new CleanOverlayMenu(this.scene, { bounds: PANEL, dimAlpha: 0.78 });
        menu.add(this.text(GAME_WIDTH / 2, 40, 'INVENTÁRIO', 26, CLEAN_MENU_COLORS.text).setOrigin(0.5));
        addUpgradePanel(this.scene, menu, this.options.upgrades, CARDS);
        this.addChimarraos(menu);
        this.addDoll(menu);
        this.addEquipmentSlots(menu);
        this.addDetails(menu);
        this.addItemGrid(menu);
        menu.addButton('VOLTAR', 446, this.options.onBack, { width: 220, height: 38, fontSize: '19px' });
        menu.enableKeyboardNavigation({ onCancel: this.options.onBack });
        // E equipa ou retira o item selecionado, sem precisar do mouse.
        const keyboard = this.scene.input.keyboard;
        const toggle = () => this.toggleSelected();
        keyboard?.on('keydown-E', toggle);
        this.scene.events.once('shutdown', () => keyboard?.off('keydown-E', toggle));
        menu.fadeIn();
    }

    private get equippedItems() {
        return this.options.items.filter(({ equipped }) => equipped);
    }

    private toggleSelected() {
        const item = this.options.items[this.selectedItem];
        if (item?.id) this.options.onToggle?.(item.id, this.selectedItem);
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
        // O que vai na cabeça e nos pés aparece no boneco, como no personagem pelo mapa.
        for (const equipped of this.equippedItems) {
            const item = equipped.id ? ITEMS[equipped.id] : undefined;
            if (!item) continue;
            menu.add(this.scene.add.image(doll.x, doll.y + getItemOffsetY(item, doll.displayHeight), item.texture).setScale(doll.scale));
        }
    }

    private addEquipmentSlots(menu: CleanOverlayMenu) {
        EQUIPMENT_SLOTS.forEach((label, index) => {
            const y = DOLL.y + 14 + index * 52;
            const x = DOLL.x + DOLL.width + 26;
            const equipped = this.equippedItems.find(({ slot }) => slot === label);
            const slot = this.scene.add.rectangle(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT, CLEAN_MENU_COLORS.button)
                .setStrokeStyle(equipped ? 2 : 1, CLEAN_MENU_COLORS.frame, equipped ? 1 : 0.6);
            // Clicar no encaixe seleciona o item para poder retirá-lo.
            if (equipped) {
                slot.setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.selectItem(this.options.items.indexOf(equipped)));
            }
            menu.add([
                slot,
                this.text(x + SLOT + 10, y + 12, label, 12, CLEAN_MENU_COLORS.text),
                this.text(x + SLOT + 10, y + 28, equipped?.name ?? 'VAZIO', 10, CLEAN_MENU_COLORS.mutedText)
            ]);
            if (equipped) {
                const icon = this.scene.add.image(x + SLOT / 2, y + SLOT / 2, equipped.texture);
                menu.add(icon.setScale((SLOT - 10) / Math.max(icon.width, icon.height)));
            }
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
        const buttonY = DETAILS.y + DETAILS.height - 30;
        this.toggleButton = this.scene.add.rectangle(DETAILS.x + DETAILS.width / 2, buttonY, 150, 32, CLEAN_MENU_COLORS.button)
            .setStrokeStyle(2, CLEAN_MENU_COLORS.frame)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSelected());
        this.toggleLabel = this.text(DETAILS.x + DETAILS.width / 2, buttonY, '', 14, CLEAN_MENU_COLORS.text).setOrigin(0.5);
        menu.add([this.box(DETAILS), this.detailTitle, this.detailText, this.toggleButton, this.toggleLabel]);
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
            if (item.equipped) menu.add(this.text(x + SLOT / 2 - 9, y - SLOT / 2 + 8, 'E', 9, CLEAN_MENU_COLORS.frameCss).setOrigin(0.5));
            this.itemSlots[index] = slot;
        }
        this.selectItem(this.options.selectedItem ?? 0);
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
        const status = selected?.id ? `\n\n${selected.equipped ? 'EQUIPADO' : 'GUARDADO'}` : '';
        this.detailText?.setText(`${selected?.description ?? 'OS ITENS PEGOS PELO MAPA FICAM GUARDADOS AQUI.'}${status}`);
        const canToggle = !!selected?.id && !!this.options.onToggle;
        this.toggleButton?.setVisible(canToggle);
        this.toggleLabel?.setVisible(canToggle).setText(selected?.equipped ? 'RETIRAR' : 'EQUIPAR');
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
