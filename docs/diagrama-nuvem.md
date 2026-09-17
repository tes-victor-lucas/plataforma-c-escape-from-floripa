# Arquitetura de nuvem AWS

Esta é uma proposta simples de arquitetura para o jogo **Plataforma C: Escape from Floripa**. A ideia é colocar o jogo web na AWS, guardar usuários e placar com segurança e deixar preparado o caminho para o multiplayer.

## Diagrama

```mermaid
flowchart LR
    J["Jogador<br/>navegador"]
    LOGIN["Google / Apple"]

    subgraph Web["Site do jogo"]
        R53["Route 53<br/>endereço do jogo"]
        CF["CloudFront<br/>HTTPS e cache"]
        S3["S3<br/>frontend e assets"]
    end

    subgraph Backend["Backend na AWS"]
        COG["Cognito<br/>login"]
        API["API Gateway<br/>API REST"]
        LAMBDA["Lambda<br/>regras do backend"]
        DB["DynamoDB<br/>usuários, runs e placar"]
    end

    subgraph Multi["Multiplayer"]
        IOT["IoT Core<br/>broker de mensagens"]
        GL["GameLift Servers<br/>partidas multiplayer"]
    end

    subgraph Support["Apoio"]
        EVENT["EventBridge + SQS<br/>eventos e fila"]
        NOTIFY["SES / SNS<br/>e-mail e notificações"]
        LOG["CloudWatch<br/>logs e alarmes"]
    end

    J --> R53 --> CF --> S3
    J -->|"login"| COG
    COG <--> LOGIN
    J -->|"requisições REST"| API --> LAMBDA --> DB
    J <-->|"mensagens da partida"| IOT <-->|"estado da partida"| GL
    LAMBDA -->|"cria/consulta partida"| GL
    LAMBDA --> EVENT --> NOTIFY
    LAMBDA --> LOG
    GL --> LOG
```

## Explicação

- **Site do jogo:** o jogador acessa um endereço do Route 53. O CloudFront entrega o frontend e os arquivos do jogo (imagens, sons e mapas), que ficam no S3. O CloudFront também fornece HTTPS.

- **Login:** o Cognito permite entrar com Google ou Apple. Depois do login, ele identifica o usuário para que cada tempo no placar fique associado à pessoa correta.

- **Backend:** o frontend chama a API REST no API Gateway. As funções Lambda executam as regras que precisam ficar na nuvem, como iniciar/finalizar uma run, salvar o tempo e consultar o placar. O DynamoDB guarda usuários, runs vencedoras e o ranking.

- **Placar:** somente runs vencidas são salvas. O banco consulta os tempos do menor para o maior; portanto, quem terminou mais rápido aparece primeiro. O tempo deve ser confirmado pelo backend/servidor, e não aceito diretamente do navegador.

- **Multiplayer:** o GameLift Servers é o serviço da AWS voltado a hospedar partidas. O IoT Core funciona como o **broker**: recebe mensagens dos jogadores e distribui as atualizações da partida. O GameLift valida as ações importantes, como vitória e derrota.

- **Notificações e logs:** quando algo importante acontece, como uma run concluída, o EventBridge e o SQS enviam o evento para processamento sem atrasar o jogo. SES pode enviar e-mails e SNS notificações. CloudWatch guarda logs e ajuda a encontrar erros.



