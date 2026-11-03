# Sprites de inimigos

As folhas `patinete-autonomo/patinete-autonomo.png` e
`guarda-municipal-cyber/guarda-municipal-cyber.png` usam a mesma grade:

- tamanho da folha: `256x128` pixels;
- tamanho do quadro: `32x32` pixels;
- 8 colunas por 4 linhas;
- linhas: baixo, esquerda, direita e cima;
- quadros de caminhada/movimento: colunas 0 a 3;
- pose defensiva ou aviso: coluna 4;
- preparação/investida: coluna 5;
- dano/ataque: coluna 6;
- destruído/derrotado: coluna 7.

Os arquivos com sufixo `-source.png` preservam a geração em alta resolução.
As versões sem o sufixo são as folhas prontas para carregar no Phaser com
`frameWidth: 32` e `frameHeight: 32`.

## Índices por direção

| Direção | Movimento | Ações especiais |
| --- | --- | --- |
| Baixo | 0–3 | 4–7 |
| Esquerda | 8–11 | 12–15 |
| Direita | 16–19 | 20–23 |
| Cima | 24–27 | 28–31 |
