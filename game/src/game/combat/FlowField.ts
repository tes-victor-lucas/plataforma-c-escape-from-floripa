type Point = Readonly<{ x: number; y: number }>;

const STRAIGHT = 10;
const DIAGONAL = 14;
// Passar colado em parede ou obstáculo custa mais: o caminho prefere o meio da passagem,
// onde os corpos (mais largos que um quadrado) não enroscam nas quinas.
const NEAR_WALL = 20;
// No quadrado do alvo ou colado nele o inimigo já vai em linha reta.
const DIRECT_TILES = 1;

const NEIGHBORS = [
    [1, 0, STRAIGHT], [-1, 0, STRAIGHT], [0, 1, STRAIGHT], [0, -1, STRAIGHT],
    [1, 1, DIAGONAL], [1, -1, DIAGONAL], [-1, 1, DIAGONAL], [-1, -1, DIAGONAL]
] as const;

/**
 * Campo de fluxo da horda: um único cálculo de distâncias até o alvo, contornando obstáculos,
 * e cada inimigo só olha para o quadrado vizinho mais perto. Serve a horda inteira de uma vez.
 */
export class FlowField {
    private readonly cost: Uint8Array;
    private readonly distance: Float64Array;
    private targetTile = -1;

    constructor(
        private readonly width: number,
        private readonly height: number,
        private readonly tileSize: number,
        isBlocked: (tileX: number, tileY: number) => boolean
    ) {
        this.cost = new Uint8Array(width * height);
        this.distance = new Float64Array(width * height).fill(Infinity);
        const wall = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || isBlocked(x, y);
        // Os corpos têm ~16,5 px: passagem de um quadrado só (16 px) entala, então conta como parede.
        const solid = (x: number, y: number) => wall(x, y)
            || (wall(x - 1, y) && wall(x + 1, y))
            || (wall(x, y - 1) && wall(x, y + 1));
        for (let tileY = 0; tileY < height; tileY += 1) {
            for (let tileX = 0; tileX < width; tileX += 1) {
                if (solid(tileX, tileY)) {
                    this.cost[tileY * width + tileX] = 0;
                    continue;
                }
                const nearWall = NEIGHBORS.some(([offsetX, offsetY]) => solid(tileX + offsetX, tileY + offsetY));
                this.cost[tileY * width + tileX] = nearWall ? 1 + NEAR_WALL : 1;
            }
        }
    }

    /** Recalcula só quando o alvo troca de quadrado. */
    update(target: Point) {
        const tile = this.tileAt(target);
        if (tile === this.targetTile) return;
        this.targetTile = tile;
        this.distance.fill(Infinity);
        if (tile < 0 || this.cost[tile] === 0) return;

        // Dijkstra com fila de prioridade simples: o mapa tem só alguns milhares de quadrados.
        const heap: number[] = [tile];
        this.distance[tile] = 0;
        while (heap.length > 0) {
            const current = popMin(heap, this.distance);
            const currentX = current % this.width;
            const currentY = Math.floor(current / this.width);
            for (const [offsetX, offsetY, step] of NEIGHBORS) {
                const next = this.passableNeighbor(currentX, currentY, offsetX, offsetY);
                if (next < 0) continue;
                const extra = this.cost[next] > 1 ? NEAR_WALL : 0;
                const candidate = this.distance[current] + step + extra;
                if (candidate >= this.distance[next]) continue;
                this.distance[next] = candidate;
                pushHeap(heap, next, this.distance);
            }
        }
    }

    /**
     * Direção unitária para o próximo quadrado do caminho.
     * `undefined` quando já está perto do alvo ou fora do mapa navegável: aí vale a linha reta.
     */
    directionFrom(position: Point): Point | undefined {
        const tile = this.tileAt(position);
        if (tile < 0) return undefined;
        const here = this.distance[tile];
        const tileX = tile % this.width;
        const tileY = Math.floor(tile / this.width);
        const targetX = this.targetTile % this.width;
        const targetY = Math.floor(this.targetTile / this.width);
        if (this.targetTile < 0 || Math.max(Math.abs(tileX - targetX), Math.abs(tileY - targetY)) <= DIRECT_TILES) {
            return undefined;
        }
        let best = -1;
        let bestDistance = here;
        for (const [offsetX, offsetY] of NEIGHBORS) {
            const next = this.passableNeighbor(tileX, tileY, offsetX, offsetY);
            if (next >= 0 && this.distance[next] < bestDistance) {
                best = next;
                bestDistance = this.distance[next];
            }
        }
        if (best < 0) return undefined;
        const goalX = (best % this.width + 0.5) * this.tileSize;
        const goalY = (Math.floor(best / this.width) + 0.5) * this.tileSize;
        const length = Math.hypot(goalX - position.x, goalY - position.y) || 1;
        return { x: (goalX - position.x) / length, y: (goalY - position.y) / length };
    }

    /**
     * Existe caminho de verdade daqui até o alvo atual.
     * Com o alvo num ponto estreito o campo fica vazio; aí não dá para afirmar nada e responde que sim.
     */
    isReachable(position: Point) {
        if (this.targetTile < 0 || this.distance[this.targetTile] !== 0) return true;
        const tile = this.tileAt(position);
        return tile >= 0 && Number.isFinite(this.distance[tile]);
    }

    private tileAt(point: Point) {
        const tileX = Math.floor(point.x / this.tileSize);
        const tileY = Math.floor(point.y / this.tileSize);
        if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) return -1;
        return tileY * this.width + tileX;
    }

    /** Vizinho livre; na diagonal, as duas laterais também precisam estar livres (sem cortar quina). */
    private passableNeighbor(tileX: number, tileY: number, offsetX: number, offsetY: number) {
        const x = tileX + offsetX;
        const y = tileY + offsetY;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
        const next = y * this.width + x;
        if (this.cost[next] === 0) return -1;
        if (offsetX !== 0 && offsetY !== 0
            && (this.cost[tileY * this.width + x] === 0 || this.cost[y * this.width + tileX] === 0)) return -1;
        return next;
    }
}

function pushHeap(heap: number[], value: number, priority: Float64Array) {
    heap.push(value);
    let index = heap.length - 1;
    while (index > 0) {
        const parent = (index - 1) >> 1;
        if (priority[heap[parent]] <= priority[heap[index]]) break;
        [heap[parent], heap[index]] = [heap[index], heap[parent]];
        index = parent;
    }
}

function popMin(heap: number[], priority: Float64Array) {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
        heap[0] = last;
        let index = 0;
        for (;;) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;
            if (left < heap.length && priority[heap[left]] < priority[heap[smallest]]) smallest = left;
            if (right < heap.length && priority[heap[right]] < priority[heap[smallest]]) smallest = right;
            if (smallest === index) break;
            [heap[smallest], heap[index]] = [heap[index], heap[smallest]];
            index = smallest;
        }
    }
    return top;
}
