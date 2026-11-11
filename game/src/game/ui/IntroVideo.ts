/** Abertura "Último ônibus" (video/intro): toca em tela cheia sobre o jogo e termina no corte para a sala 1. */
export const INTRO_VIDEO_URL = 'assets/video/intro.mp4';

/** Qualquer tecla, clique, toque ou botão do controle pula; se o vídeo não carregar, segue direto para o jogo. */
export function playIntroVideo(): Promise<void> {
    // Em tela cheia só o elemento em fullscreen aparece; o vídeo precisa ficar dentro dele.
    const parent = document.fullscreenElement ?? document.body;
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#000;display:flex;'
            + 'align-items:center;justify-content:center;cursor:pointer;';
        const video = document.createElement('video');
        video.src = INTRO_VIDEO_URL;
        video.playsInline = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
        const hint = document.createElement('div');
        hint.textContent = 'PULAR ▶';
        hint.style.cssText = 'position:absolute;right:24px;bottom:20px;color:#ffffff;opacity:0.7;'
            + 'font:20px PixelGamer, monospace;letter-spacing:2px;text-shadow:2px 2px 0 #000;';
        overlay.append(video, hint);
        parent.appendChild(overlay);

        let done = false;
        let frame = 0;
        // Botão já apertado ao abrir (o A que escolheu JOGAR SOLO) não conta como pular.
        const heldAtStart = new Set(pressedGamepadButtons());
        const finish = () => {
            if (done) return;
            done = true;
            cancelAnimationFrame(frame);
            window.removeEventListener('keydown', finish, true);
            overlay.removeEventListener('pointerdown', finish);
            video.pause();
            video.removeAttribute('src');
            video.load();
            overlay.remove();
            resolve();
        };
        const pollGamepad = () => {
            const pressed = pressedGamepadButtons();
            for (const id of [...heldAtStart]) if (!pressed.includes(id)) heldAtStart.delete(id);
            if (pressed.some((id) => !heldAtStart.has(id))) return finish();
            frame = requestAnimationFrame(pollGamepad);
        };

        window.addEventListener('keydown', finish, true);
        overlay.addEventListener('pointerdown', finish);
        video.addEventListener('ended', finish);
        video.addEventListener('error', finish);
        frame = requestAnimationFrame(pollGamepad);
        video.play().catch(finish);
    });
}

function pressedGamepadButtons(): string[] {
    const ids: string[] = [];
    for (const pad of navigator.getGamepads?.() ?? []) {
        pad?.buttons.forEach((button, index) => { if (button.pressed) ids.push(`${pad.index}:${index}`); });
    }
    return ids;
}
