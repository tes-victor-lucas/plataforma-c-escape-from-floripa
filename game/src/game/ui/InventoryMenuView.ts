import type { Scene } from 'phaser';
import { CHARACTERS, type CharacterId } from '../config/characters';
import type { EquipmentSlot, ItemId } from '../config/items';
import { ITEMS } from '../config/items';
import { getItemOffsetY } from '../entities/WornItem';
import { WALK_FRAMES } from '../entities/PlayerAnimations';
import { bindGamepadActions } from '../input/GamepadInput';
import type { UpgradeProgress } from '../upgrades/types';
import { CleanOverlayMenu, drawCleanMenuBox, type CleanMenuBounds } from './CleanOverlayMenu';
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
// Paleta própria do inventário, sem o ciano neon dos outros menus: carvão, moldura âmbar e o vermelho do jogo.
const INV = {
    panel: 0x25272c,
    raised: 0x30333a,
    well: 0x1a1b1f,
    backdrop: 0x46525c,
    floor: 0x343d45,
    outline: 0x0c0c0f,
    band: 0xd68a2c,
    shine: 0xf6c56c,
    bandCss: '#f2bb62',
    accent: 0xe90931,
    text: '#f4efe6',
    muted: '#a8a296'
} as const;
const PANEL = { x: 16, y: 34, width: 857, height: 452 };
// Aba do título, presa por cima do painel como a orelha de uma pasta.
const TITLE_TAB = { x: 36, y: 8, width: 190, height: 36 };
// Botão de fechar, outra aba na ponta direita.
const CLOSE_TAB = { x: 823, y: 8, width: 36, height: 36 };
const CARDS = { x: 36, y: 66, width: 174, height: 300 };
const CHIMARRAO = { x: 36, y: 378, width: 174, height: 50 };
// Retrato do personagem, um cartão em pé como numa ficha.
const DOLL = { x: 232, y: 66, width: 150, height: 172 };
const DETAILS = { x: 610, y: 66, width: 243, height: 220 };
// Encaixes do boneco; cada item de equipar ocupa o seu.
const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['CABEÇA', 'CORPO', 'MÃOS', 'PÉS'];
const SLOT = 44;
const GRID = { x: 232, y: 308, columns: 12, rows: 2, gap: 6 };
// Onde soltar um item arrastado: boneco e encaixes equipam; a grade de baixo guarda.
const EQUIP_ZONE = { x: DOLL.x, y: DOLL.y, width: DETAILS.x - DOLL.x, height: DOLL.height };
const STORAGE_ZONE = {
    x: GRID.x,
    y: GRID.y,
    width: GRID.columns * (SLOT + GRID.gap),
    height: GRID.rows * (SLOT + GRID.gap)
};

/** Caixa de moldura dupla: contorno, faixa colorida e outro contorno por dentro, com os cantos cortados. */
function drawFramedBox(graphics: Phaser.GameObjects.Graphics, bounds: CleanMenuBounds, fill: number = INV.raised) {
    const { x, y, width, height } = bounds;
    drawCleanMenuBox(graphics, bounds, INV.band, INV.outline, 4, 2);
    drawCleanMenuBox(graphics, { x: x + 5, y: y + 5, width: width - 10, height: height - 10 }, fill, INV.outline, 2, 2);
    graphics.fillStyle(INV.shine, 1).fillRect(x + 4, y + 2, width - 8, 1);
}

/** Item guardado solto no boneco ou nos encaixes equipa; item equipado solto na grade volta a ser guardado. */
export function shouldToggleOnDrop(equipped: boolean, x: number, y: number) {
    const zone = equipped ? STORAGE_ZONE : EQUIP_ZONE;
    return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
}

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
        // A moldura dupla cobre o painel padrão dos menus: o inventário tem cara própria.
        const panel = this.scene.add.graphics();
        // A aba vem antes: o painel passa por cima da base dela e os dois viram uma peça só.
        drawFramedBox(panel, TITLE_TAB, INV.panel);
        drawFramedBox(panel, PANEL, INV.panel);
        panel.fillStyle(INV.panel, 1).fillRect(TITLE_TAB.x + 7, PANEL.y, TITLE_TAB.width - 14, 7);
        menu.add(panel);
        menu.add(this.text(TITLE_TAB.x + TITLE_TAB.width / 2, TITLE_TAB.y + 17, 'INVENTÁRIO', 18, INV.text).setOrigin(0.5));
        this.addCloseTab(menu);
        // A moldura é a do inventário; o painel de upgrades vai por dentro, sem a borda própria.
        menu.add(this.box(CARDS));
        addUpgradePanel(
            this.scene,
            menu,
            this.options.upgrades,
            { x: CARDS.x + 7, y: CARDS.y + 7, width: CARDS.width - 14, height: CARDS.height - 14 },
            { panel: INV.raised, frame: INV.raised, button: INV.well, buttonHover: INV.band, text: INV.text, mutedText: INV.muted }
        );
        this.addChimarraos(menu);
        this.addDoll(menu);
        this.addEquipmentSlots(menu);
        this.addDetails(menu);
        this.addItemGrid(menu);
        // Sem o botão VOLTAR: fecha no X, no ESC ou no botão de voltar do controle.
        // E equipa ou retira o item selecionado, sem precisar do mouse.
        const keyboard = this.scene.input.keyboard;
        const toggle = () => this.toggleSelected();
        keyboard?.on('keydown-E', toggle);
        keyboard?.once('keydown-ESC', this.options.onBack);
        bindGamepadActions(this.scene, { cancel: this.options.onBack, confirm: toggle });
        this.scene.events.once('shutdown', () => {
            keyboard?.off('keydown-E', toggle);
            keyboard?.off('keydown-ESC', this.options.onBack);
        });
        // Redesenho depois de equipar ou retirar: sem a animação de abertura, o menu não parece fechar e abrir.
        if (this.options.selectedItem === undefined) menu.fadeIn();
    }

    /** X vermelho no canto: fecha com o mouse sem precisar descer até o VOLTAR. */
    private addCloseTab(menu: CleanOverlayMenu) {
        const { x, y, width, height } = CLOSE_TAB;
        const tab = this.scene.add.graphics();
        drawFramedBox(tab, { x, y, width, height: height - 6 }, INV.accent);
        const hitArea = this.scene.add.rectangle(x + width / 2, y + 15, width, height - 6, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', this.options.onBack);
        menu.add([tab, this.text(x + width / 2, y + 15, 'X', 16, INV.text).setOrigin(0.5), hitArea]);
    }

    private get equippedItems() {
        return this.options.items.filter(({ equipped }) => equipped);
    }

    /** Com o mouse, o ícone pode ser arrastado; solto no lugar certo troca o item, fora dele volta para o encaixe. */
    private makeDraggable(menu: CleanOverlayMenu, icon: Phaser.GameObjects.Image, index: number) {
        const item = this.options.items[index];
        const id = item?.id;
        if (!id || !this.options.onToggle) return;
        const home = { x: icon.x, y: icon.y };
        icon.setInteractive({ useHandCursor: true, draggable: true })
            .on('pointerdown', () => this.selectItem(index))
            .on('dragstart', () => menu.root.bringToTop(icon))
            .on('drag', (_pointer: unknown, x: number, y: number) => icon.setPosition(x, y))
            .on('dragend', () => {
                if (shouldToggleOnDrop(!!item.equipped, icon.x, icon.y)) this.options.onToggle?.(id, index);
                else icon.setPosition(home.x, home.y);
            });
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
            this.text(CHIMARRAO.x + 48, centerY - 9, 'CHIMARRÕES', 11, INV.muted),
            this.text(CHIMARRAO.x + 48, centerY + 7, `${this.options.chimarraos}`, 18, INV.text)
        ]);
    }

    private addDoll(menu: CleanOverlayMenu) {
        // Fundo mais claro que o painel e uma faixa de chão: o personagem se destaca como numa foto.
        const grid = this.scene.add.graphics();
        drawFramedBox(grid, DOLL, INV.backdrop);
        grid.fillStyle(INV.floor, 1).fillRect(DOLL.x + 7, DOLL.y + DOLL.height - 43, DOLL.width - 14, 36);
        const character = CHARACTERS[this.options.characterId];
        // De frente e parado, ampliado: os itens equipados vão aparecer por cima dele.
        const doll = this.scene.add.image(DOLL.x + DOLL.width / 2, DOLL.y + DOLL.height / 2 + 2, character.texture, WALK_FRAMES.down[0])
            .setScale(3.6 * character.scaleMultiplier);
        menu.add([grid, doll, this.text(DOLL.x + DOLL.width / 2, DOLL.y + DOLL.height - 16, character.label, 12, INV.bandCss).setOrigin(0.5)]);
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
            const slot = this.scene.add.rectangle(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT, INV.well)
                .setStrokeStyle(equipped ? 2 : 1, INV.band, equipped ? 1 : 0.6);
            // Clicar no encaixe seleciona o item para poder retirá-lo.
            if (equipped) {
                slot.setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.selectItem(this.options.items.indexOf(equipped)));
            }
            menu.add([
                slot,
                this.text(x + SLOT + 10, y + 12, label, 12, INV.text),
                this.text(x + SLOT + 10, y + 28, equipped?.name ?? 'VAZIO', 10, INV.muted)
            ]);
            if (equipped) {
                const icon = this.scene.add.image(x + SLOT / 2, y + SLOT / 2, equipped.texture);
                menu.add(icon.setScale((SLOT - 10) / Math.max(icon.width, icon.height)));
                this.makeDraggable(menu, icon, this.options.items.indexOf(equipped));
            }
        });
    }

    private addDetails(menu: CleanOverlayMenu) {
        this.detailTitle = this.text(DETAILS.x + 16, DETAILS.y + 18, '', 15, INV.text);
        this.detailText = this.scene.add.text(DETAILS.x + 16, DETAILS.y + 48, '', {
            fontFamily: FONT,
            fontSize: '11px',
            color: INV.muted,
            lineSpacing: 6,
            wordWrap: { width: DETAILS.width - 32, useAdvancedWrap: true }
        }).setResolution(2);
        const buttonY = DETAILS.y + DETAILS.height - 30;
        this.toggleButton = this.scene.add.rectangle(DETAILS.x + DETAILS.width / 2, buttonY, 150, 32, INV.well)
            .setStrokeStyle(2, INV.band)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSelected());
        this.toggleLabel = this.text(DETAILS.x + DETAILS.width / 2, buttonY, '', 14, INV.text).setOrigin(0.5);
        menu.add([this.box(DETAILS), this.detailTitle, this.detailText, this.toggleButton, this.toggleLabel]);
    }

    private addItemGrid(menu: CleanOverlayMenu) {
        const { items } = this.options;
        this.itemSlots = [];
        for (let index = 0; index < GRID.columns * GRID.rows; index += 1) {
            const x = GRID.x + (index % GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const y = GRID.y + Math.floor(index / GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const slot = this.scene.add.rectangle(x, y, SLOT, SLOT, INV.well);
            menu.add(slot);
            const item = items[index];
            if (!item) {
                slot.setStrokeStyle(1, INV.band, 0.35);
                continue;
            }
            const icon = this.scene.add.image(x, y, item.texture);
            icon.setScale((SLOT - 8) / Math.max(icon.width, icon.height));
            slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectItem(index));
            menu.add(icon);
            // O equipado sai pelo encaixe do boneco; na grade só o guardado é arrastável.
            if (!item.equipped) this.makeDraggable(menu, icon, index);
            if (item.equipped) menu.add(this.text(x + SLOT / 2 - 9, y - SLOT / 2 + 8, 'E', 9, INV.bandCss).setOrigin(0.5));
            this.itemSlots[index] = slot;
        }
        this.selectItem(this.options.selectedItem ?? 0);
    }

    private selectItem(index: number) {
        const item = this.options.items[index];
        this.selectedItem = item ? index : this.selectedItem;
        this.itemSlots.forEach((slot, slotIndex) => slot?.setStrokeStyle(
            slotIndex === this.selectedItem ? 3 : 1,
            slotIndex === this.selectedItem ? INV.accent : INV.band
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
        drawFramedBox(graphics, bounds);
        return graphics;
    }

    private text(x: number, y: number, value: string, size: number, color: string) {
        return this.scene.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color })
            .setOrigin(0, 0.5)
            .setResolution(2);
    }
}
