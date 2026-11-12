import type { Scene } from 'phaser';
import { CHARACTERS, type CharacterId } from '../config/characters';
import type { EquipmentSlot, ItemId } from '../config/items';
import { ITEMS } from '../config/items';
import { getItemOffsetY, getWornTexture } from '../entities/WornItem';
import { WALK_FRAMES } from '../entities/PlayerAnimations';
import { bindGamepadActions } from '../input/GamepadInput';
import { isTouchScreen } from '../input/TouchInput';
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
    ink: '#1b1307',
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
// Balão de descrição que acompanha o item selecionado.
const TOOLTIP_WIDTH = 232;
// Linhas de atributos à direita dos encaixes: onde as barrinhas começam e a distância entre as linhas.
const STATS = { x: 548, y: 84, rowGap: 34, pipWidth: 18 };
const TOGGLE = { x: 656, y: 210 };
const DRAG_THRESHOLD = 6;
const TOUCH_LIFT = 30;
// Encaixes do boneco; cada item de equipar ocupa o seu.
const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['CABEÇA', 'CORPO', 'MÃOS', 'PÉS'];
const SLOT = 44;
// Bandeja dos itens guardados, com a etiqueta presa na borda de cima.
const TRAY = { x: 232, y: 300, width: 621, height: 124 };
const TRAY_LABEL = { x: 250, y: 282, width: 104, height: 30 };
const GRID = { x: 246, y: 318, columns: 12, rows: 2, gap: 6 };
// Onde soltar um item arrastado: boneco e encaixes equipam; a grade de baixo guarda.
const EQUIP_ZONE = { x: DOLL.x, y: DOLL.y, width: DOLL.width + 12 + SLOT, height: 4 * (SLOT + 6) };
const STORAGE_ZONE = TRAY;

/** Caixa de moldura dupla: contorno, faixa colorida e outro contorno por dentro, com os cantos cortados. */
function drawFramedBox(graphics: Phaser.GameObjects.Graphics, bounds: CleanMenuBounds, fill: number = INV.raised) {
    const { x, y, width, height } = bounds;
    drawCleanMenuBox(graphics, bounds, INV.band, INV.outline, 4, 2);
    drawCleanMenuBox(graphics, { x: x + 5, y: y + 5, width: width - 10, height: height - 10 }, fill, INV.outline, 2, 2);
    graphics.fillStyle(INV.shine, 1).fillRect(x + 4, y + 2, width - 8, 1);
}

export type EquipmentStat = Readonly<{ label: string; pips: number; value: string }>;
const STAT_PIPS = 10;

/** O que os itens vestidos fazem somados: barrinhas de 0 a 10 e o número exato ao lado. */
export function getEquipmentStats(ids: readonly ItemId[]): EquipmentStat[] {
    const worn = ids.map((id) => ITEMS[id]);
    const block = Math.max(0, ...worn.map(({ blockChance }) => blockChance));
    const speed = worn.reduce((total, { speedMultiplier }) => total * speedMultiplier, 1) - 1;
    const dash = 1 - worn.reduce((total, { dashCooldownMultiplier }) => total * dashCooldownMultiplier, 1);
    const pips = (value: number, perPip: number) => Math.min(STAT_PIPS, Math.round(value / perPip));
    // Sem bônus fica só "0%": sinal na frente de zero parece erro.
    const percent = (value: number, sign = '') => `${Math.round(value * 100) === 0 ? '' : sign}${Math.round(value * 100)}%`;
    return [
        { label: 'BLOQUEIO', pips: pips(block, 0.1), value: percent(block) },
        // A velocidade sobe pouco por item: cada barrinha vale 5%.
        { label: 'VELOCIDADE', pips: pips(speed, 0.05), value: percent(speed, '+') },
        // No dash o ganho é recarga menor, por isso o sinal de menos.
        { label: 'DASH', pips: pips(dash, 0.1), value: percent(dash, '-') }
    ];
}

/**
 * Próximo item ao andar pela mochila com as setas ou o controle. Para os lados segue a ordem dos itens;
 * para cima e para baixo troca de linha, e uma linha de baixo mais curta leva ao último item dela.
 */
export function moveInventorySelection(index: number, count: number, dx: number, dy: number, columns: number = GRID.columns) {
    if (count === 0) return index;
    if (dx !== 0) return Math.max(0, Math.min(count - 1, index + dx));
    const next = index + dy * columns;
    if (next < 0) return index;
    if (next < count) return next;
    const lastRow = Math.floor((count - 1) / columns);
    return Math.floor(index / columns) < lastRow ? count - 1 : index;
}

/** O balão nasce à direita e abaixo do meio do encaixe e é empurrado para dentro do painel quando não cabe. */
export function getTooltipPosition(slotX: number, slotY: number, height: number) {
    return {
        x: Math.min(slotX + 14, PANEL.x + PANEL.width - TOOLTIP_WIDTH - 10),
        y: Math.min(slotY + 10, PANEL.y + PANEL.height - height - 10)
    };
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
    private detailStatus?: Phaser.GameObjects.Text;
    private tooltip?: Phaser.GameObjects.Container;
    private tooltipBox?: Phaser.GameObjects.Graphics;
    private isDragging = false;
    private dropZone?: Phaser.GameObjects.Graphics;
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
        this.addStats(menu);
        this.addDetails(menu);
        this.addToggleButton(menu);
        this.addItemGrid(menu);
        // O balão foi criado antes da grade (ela já seleciona um item) e precisa ficar por cima dela.
        if (this.tooltip) menu.root.bringToTop(this.tooltip);
        // Rodapé com os atalhos; no celular não há teclas nem arrasto para explicar.
        if (!isTouchScreen()) {
            menu.add(this.text(
                TRAY.x + TRAY.width / 2,
                PANEL.y + PANEL.height - 30,
                'SETAS  ESCOLHER     E  EQUIPAR / RETIRAR     ARRASTE ATÉ O BONECO PARA EQUIPAR     ESC  FECHAR',
                10,
                INV.muted
            ).setOrigin(0.5));
        }
        // Sem o botão VOLTAR: fecha no X, no ESC ou no botão de voltar do controle.
        // E, ENTER ou espaço equipam ou retiram o item selecionado; setas ou WASD andam pela mochila.
        const keyboard = this.scene.input.keyboard;
        const toggle = () => this.toggleSelected();
        const left = () => this.moveSelection(-1, 0);
        const right = () => this.moveSelection(1, 0);
        const up = () => this.moveSelection(0, -1);
        const down = () => this.moveSelection(0, 1);
        const keys: Record<string, () => void> = {
            E: toggle, ENTER: toggle, SPACE: toggle,
            LEFT: left, A: left, RIGHT: right, D: right,
            UP: up, W: up, DOWN: down, S: down
        };
        for (const [key, handler] of Object.entries(keys)) keyboard?.on(`keydown-${key}`, handler);
        keyboard?.once('keydown-ESC', this.options.onBack);
        bindGamepadActions(this.scene, { cancel: this.options.onBack, confirm: toggle, left, right, up, down });
        this.scene.events.once('shutdown', () => {
            for (const [key, handler] of Object.entries(keys)) keyboard?.off(`keydown-${key}`, handler);
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
        // Invisível em repouso; com o mouse em cima, clareia o X.
        const hitArea = this.scene.add.rectangle(x + width / 2, y + 15, width - 10, height - 16, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', this.options.onBack)
            .on('pointerover', () => hitArea.setFillStyle(0xffffff, 0.25))
            .on('pointerout', () => hitArea.setFillStyle(0xffffff, 0));
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
        // Um toque com o dedo tremendo não pode virar arrasto: só arrasta depois de andar alguns pixels.
        this.scene.input.dragDistanceThreshold = DRAG_THRESHOLD;
        icon.setInteractive({ useHandCursor: true, draggable: true })
            .on('pointerdown', () => this.selectItem(index))
            .on('pointerover', () => this.selectItem(index))
            .on('dragstart', () => {
                // Durante o arrasto o balão sairia do lugar e taparia onde soltar.
                this.isDragging = true;
                this.tooltip?.setVisible(false);
                this.showDropZone(menu, item.equipped ? STORAGE_ZONE : EQUIP_ZONE);
                menu.root.bringToTop(icon);
            })
            // No toque o item sobe acima do dedo, senão quem arrasta não vê onde está soltando.
            .on('drag', (pointer: Phaser.Input.Pointer, x: number, y: number) => icon.setPosition(x, y - (pointer.wasTouch ? TOUCH_LIFT : 0)))
            .on('dragend', () => {
                this.isDragging = false;
                this.dropZone?.setVisible(false);
                if (shouldToggleOnDrop(!!item.equipped, icon.x, icon.y)) return this.options.onToggle?.(id, index);
                icon.setPosition(home.x, home.y);
                this.tooltip?.setVisible(true);
            });
    }

    /** Mancha clara sobre a área que aceita o item arrastado: mostra para onde levar sem escrever nada. */
    private showDropZone(menu: CleanOverlayMenu, zone: CleanMenuBounds) {
        this.dropZone ??= this.scene.add.graphics();
        this.dropZone.clear().fillStyle(INV.shine, 0.2).fillRect(zone.x, zone.y, zone.width, zone.height).setVisible(true);
        menu.add(this.dropZone);
        menu.root.bringToTop(this.dropZone);
    }

    private moveSelection(dx: number, dy: number) {
        this.selectItem(moveInventorySelection(this.selectedItem, this.options.items.length, dx, dy));
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
        // O nome fica fora do cartão, embaixo, como legenda.
        menu.add([grid, doll, this.text(DOLL.x + DOLL.width / 2, DOLL.y + DOLL.height + 16, character.label, 14, INV.text).setOrigin(0.5)]);
        // O que vai na cabeça e nos pés aparece no boneco, como no personagem pelo mapa.
        for (const equipped of this.equippedItems) {
            const item = equipped.id ? ITEMS[equipped.id] : undefined;
            if (!item) continue;
            const offsetY = getItemOffsetY(item, doll.displayHeight, character.texture);
            menu.add(this.scene.add.image(doll.x, doll.y + offsetY, getWornTexture(this.scene, item, character.texture)).setScale(doll.scale));
        }
    }

    private addEquipmentSlots(menu: CleanOverlayMenu) {
        EQUIPMENT_SLOTS.forEach((label, index) => {
            // Coluna colada no retrato, da cabeça aos pés.
            const y = DOLL.y + index * (SLOT + 6);
            const x = DOLL.x + DOLL.width + 12;
            const equipped = this.equippedItems.find(({ slot }) => slot === label);
            const slot = this.scene.add.rectangle(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT, INV.well)
                .setStrokeStyle(2, equipped ? INV.band : INV.outline);
            // Clicar no encaixe seleciona o item para poder retirá-lo.
            if (equipped) {
                const select = () => this.selectItem(this.options.items.indexOf(equipped));
                slot.setInteractive({ useHandCursor: true }).on('pointerdown', select).on('pointerover', select);
            }
            menu.add(slot);
            // Vazio, o encaixe diz o que cabe nele; ocupado, o ícone fala por si.
            if (!equipped) menu.add(this.text(x + SLOT / 2, y + SLOT / 2, label, 8, INV.muted).setOrigin(0.5));
            if (equipped) {
                const icon = this.scene.add.image(x + SLOT / 2, y + SLOT / 2, equipped.texture);
                menu.add(icon.setScale((SLOT - 10) / Math.max(icon.width, icon.height)));
                this.makeDraggable(menu, icon, this.options.items.indexOf(equipped));
            }
        });
    }

    /** Uma linha por atributo: nome, dez barrinhas e o valor exato, como numa ficha de personagem. */
    private addStats(menu: CleanOverlayMenu) {
        const stats = getEquipmentStats(this.equippedItems.flatMap(({ id }) => (id ? [id] : [])));
        const bars = this.scene.add.graphics();
        menu.add(bars);
        stats.forEach(({ label, pips, value }, row) => {
            const y = STATS.y + row * STATS.rowGap;
            menu.add(this.text(STATS.x - 12, y, label, 12, INV.text).setOrigin(1, 0.5));
            for (let pip = 0; pip < STAT_PIPS; pip += 1) {
                const x = STATS.x + pip * (STATS.pipWidth + 4);
                bars.fillStyle(INV.outline, 1).fillRect(x, y - 8, STATS.pipWidth, 16);
                bars.fillStyle(pip < pips ? INV.band : INV.well, 1).fillRect(x + 2, y - 6, STATS.pipWidth - 4, 12);
                if (pip < pips) bars.fillStyle(INV.shine, 1).fillRect(x + 2, y - 6, STATS.pipWidth - 4, 2);
            }
            // Monospace porque a PixelGamer não tem o sinal de porcentagem.
            menu.add(this.scene.add.text(STATS.x + STAT_PIPS * (STATS.pipWidth + 4) + 6, y, value, {
                fontFamily: 'monospace',
                fontSize: '12px',
                fontStyle: 'bold',
                color: INV.bandCss
            }).setOrigin(0, 0.5).setResolution(2));
        });
    }

    /** Balão com o nome numa faixa e a descrição embaixo; a posição e a altura mudam a cada item. */
    private addDetails(menu: CleanOverlayMenu) {
        this.tooltipBox = this.scene.add.graphics();
        this.detailTitle = this.text(14, 19, '', 13, INV.text);
        this.detailText = this.scene.add.text(14, 38, '', {
            // Monospace porque a PixelGamer não tem o sinal de porcentagem das descrições.
            fontFamily: 'monospace',
            fontSize: '10px',
            fontStyle: 'bold',
            color: INV.muted,
            lineSpacing: 4,
            wordWrap: { width: TOOLTIP_WIDTH - 28, useAdvancedWrap: true }
        }).setResolution(2);
        // Na ponta direita da faixa do nome: onde o item está agora.
        this.detailStatus = this.text(TOOLTIP_WIDTH - 14, 19, '', 9, INV.bandCss).setOrigin(1, 0.5);
        this.tooltip = this.scene.add.container(0, 0, [this.tooltipBox, this.detailTitle, this.detailStatus, this.detailText]);
        menu.add(this.tooltip);
    }

    private placeTooltip() {
        const slot = this.itemSlots[this.selectedItem];
        if (!slot || !this.tooltip || !this.tooltipBox || !this.detailText) return;
        const height = 38 + this.detailText.height + 12;
        this.tooltipBox.clear();
        drawFramedBox(this.tooltipBox, { x: 0, y: 0, width: TOOLTIP_WIDTH, height });
        // Faixa escura atrás do nome, separando do texto sem precisar de linha.
        this.tooltipBox.fillStyle(INV.well, 1).fillRect(7, 7, TOOLTIP_WIDTH - 14, 24);
        const { x, y } = getTooltipPosition(slot.x, slot.y, height);
        this.tooltip.setPosition(x, y);
    }

    /** Botão de equipar ou retirar o item selecionado, logo abaixo dos atributos que ele muda. */
    private addToggleButton(menu: CleanOverlayMenu) {
        // Única peça preenchida de âmbar na tela: é a ação principal.
        const button = this.scene.add.rectangle(TOGGLE.x, TOGGLE.y, 170, 30, INV.band)
            .setStrokeStyle(2, INV.outline)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSelected())
            .on('pointerover', () => button.setFillStyle(INV.shine))
            .on('pointerout', () => button.setFillStyle(INV.band));
        this.toggleButton = button;
        this.toggleLabel = this.text(TOGGLE.x, TOGGLE.y, '', 14, INV.ink).setOrigin(0.5);
        menu.add([this.toggleButton, this.toggleLabel]);
    }

    private addItemGrid(menu: CleanOverlayMenu) {
        const { items } = this.options;
        this.itemSlots = [];
        // Etiqueta por cima da borda da bandeja: diz o que é sem gastar uma linha de título.
        menu.add([
            this.box(TRAY),
            this.box(TRAY_LABEL),
            this.text(TRAY_LABEL.x + TRAY_LABEL.width / 2, TRAY_LABEL.y + 15, 'MOCHILA', 13, INV.text).setOrigin(0.5)
        ]);
        for (let index = 0; index < GRID.columns * GRID.rows; index += 1) {
            const x = GRID.x + (index % GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const y = GRID.y + Math.floor(index / GRID.columns) * (SLOT + GRID.gap) + SLOT / 2;
            const slot = this.scene.add.rectangle(x, y, SLOT, SLOT, INV.well);
            menu.add(slot);
            const item = items[index];
            if (!item) {
                slot.setStrokeStyle(2, INV.outline);
                continue;
            }
            const icon = this.scene.add.image(x, y, item.texture);
            icon.setScale((SLOT - 8) / Math.max(icon.width, icon.height));
            // Passar o mouse já mostra o balão do item; no toque, vale o clique.
            slot.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.selectItem(index))
                .on('pointerover', () => this.selectItem(index));
            menu.add(icon);
            // O equipado sai pelo encaixe do boneco; na grade só o guardado é arrastável.
            if (!item.equipped) this.makeDraggable(menu, icon, index);
            // Item vestido: um canto âmbar no encaixe, da cor da moldura dos encaixes do boneco.
            if (item.equipped) menu.add(this.scene.add.triangle(x + SLOT / 2 - 2, y - SLOT / 2 + 2, -12, 0, 0, 0, 0, 12, INV.band).setOrigin(0));
            this.itemSlots[index] = slot;
        }
        this.selectItem(this.options.selectedItem ?? 0);
    }

    private selectItem(index: number) {
        // Arrastando, o ícone passa por cima de outros encaixes: a seleção não deve pular para eles.
        if (this.isDragging) return;
        const item = this.options.items[index];
        this.selectedItem = item ? index : this.selectedItem;
        // Encaixes em baixo-relevo, separados só pelo tom; o selecionado ganha a borda clara da moldura.
        this.itemSlots.forEach((slot, slotIndex) => slot?.setStrokeStyle(
            slotIndex === this.selectedItem ? 3 : 2,
            slotIndex === this.selectedItem ? INV.shine : INV.outline
        ));
        const selected = this.options.items[this.selectedItem];
        this.detailTitle?.setText(selected?.name ?? 'NENHUM ITEM');
        this.detailStatus?.setText(selected?.id ? (selected.equipped ? 'EQUIPADO' : 'GUARDADO') : '');
        this.detailText?.setText(selected?.description ?? 'OS ITENS PEGOS PELO MAPA FICAM GUARDADOS AQUI.');
        this.placeTooltip();
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
