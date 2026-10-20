import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {

    }

    create ()
    {
        this.scene.launch('Audio');
        this.scene.start('Preloader');
    }
}
