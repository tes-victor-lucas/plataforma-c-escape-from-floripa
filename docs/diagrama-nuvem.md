# Arquitetura de nuvem AWS

Esta é uma proposta simples de arquitetura para o jogo **Plataforma C: Escape from Floripa**. A ideia é colocar o jogo web na AWS, guardar usuários e placar com segurança e deixar preparado o caminho para o multiplayer.

## Diagrama

```mermaid
flowchart LR
    J["Jogador<br/>navegador"]
    WEB["Site do jogo<br/>Route 53 + CloudFront + S3"]
    LOGIN["Login<br/>Cognito + Google/Apple"]
    BACK["Backend<br/>API Gateway + Lambda"]
    DB["Banco de dados<br/>DynamoDB: usuários, runs e placar"]
    MULTI["Multiplayer<br/>GameLift + IoT Core (broker)"]
    SUPPORT["Apoio<br/>EventBridge, SQS, SES/SNS e CloudWatch"]

    J --> WEB
    J --> LOGIN
    J --> BACK
    BACK --> DB
    J <-->|"multiplayer"| MULTI
    BACK --> MULTI
    BACK --> SUPPORT
```

## Explicação

- **Site do jogo:** o jogador acessa um endereço do Route 53. O CloudFront entrega o frontend e os arquivos do jogo (imagens, sons e mapas), que ficam no S3. O CloudFront também fornece HTTPS.

- **Login:** o Cognito permite entrar com Google ou Apple. Depois do login, ele identifica o usuário para que cada tempo no placar fique associado à pessoa correta.

- **Backend:** o frontend chama a API REST no API Gateway. As funções Lambda executam as regras que precisam ficar na nuvem, como iniciar/finalizar uma run, salvar o tempo e consultar o placar. O DynamoDB guarda usuários, runs vencedoras e o ranking.

- **Placar:** somente runs vencidas são salvas. O banco consulta os tempos do menor para o maior; portanto, quem terminou mais rápido aparece primeiro. O tempo deve ser confirmado pelo backend/servidor, e não aceito diretamente do navegador.

- **Multiplayer:** o GameLift Servers é o serviço da AWS voltado a hospedar partidas. O IoT Core funciona como o **broker**: recebe mensagens dos jogadores e distribui as atualizações da partida. O GameLift valida as ações importantes, como vitória e derrota.

- **Notificações e logs:** quando algo importante acontece, como uma run concluída, o EventBridge e o SQS enviam o evento para processamento sem atrasar o jogo. SES pode enviar e-mails e SNS notificações. CloudWatch guarda logs e ajuda a encontrar erros.


