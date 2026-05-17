import { ItemView, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import { PetDefs } from "./pet-defs";
import { SpriteDefinition, SpriteEngine } from "./sprite-engine";
import { resolveSpriteAsset } from "./sprite-assets";

export const VIEW_TYPE_STARDEW = "stardew-view";

export type Pet = {
    id: string;
    name: string;
    specie: string;
    color: string;
};

type StardewViewActions = {
    getPets: () => Pet[];
    addPet: (pet: Omit<Pet, "id">) => Promise<void>;
    removePet: (id: string) => Promise<void>;
};

export class StardewView extends ItemView {
    private animationsPaused = false;
    private removeMode = false;

    constructor(leaf: WorkspaceLeaf, private actions: StardewViewActions) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_STARDEW;
    }

    getDisplayText(): string {
        return "Stardew pets";
    }

    getIcon(): string {
        return "paw-print"; // Or some icon, maybe "leaf" or custom
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('stardew-container');

        const header = container.createDiv({ cls: 'stardew-header' });
        header.createEl("h4", { text: "Stardew pets" });
        const controls = header.createDiv({ cls: "stardew-header-controls" });
        const removeButton = controls.createEl("button", {
            cls: "stardew-icon-button",
            attr: { type: "button", "aria-label": "Remove pet" },
            text: "-",
        });
        const addButton = controls.createEl("button", {
            cls: "stardew-icon-button",
            attr: { type: "button", "aria-label": "Add pet" },
            text: "+",
        });
        this.registerDomEvent(addButton, "click", () => {
            new AddPetModal(this.app, this.getPetSpecies(), (pet) => this.actions.addPet(pet)).open();
        });
        this.registerDomEvent(removeButton, "click", () => {
            this.removeMode = !this.removeMode;
            removeButton.toggleClass("is-active", this.removeMode);
            new Notice(this.removeMode ? "Select a pet to remove." : "Remove mode off.");
        });

        // Create the farm area (fills remaining space)
        const farm = container.createDiv({ cls: "stardew-farm" });

        // Set bundled background image.
        const bgUrl = this.getPluginResourcePath('sprites/backgrounds/grass.png');
        farm.setCssProps({
            "background-image": `url('${bgUrl}')`,
        });

        this.actions.getPets().forEach((pet) => this.spawnSavedPet(pet));

        this.registerDomEvent(window, 'blur', () => this.pauseAnimations());
        this.registerDomEvent(window, 'focus', () => this.resumeAnimations());
        this.registerDomEvent(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });
    }

    private readonly ANIMAL_CONFIG: Record<string, SpriteDefinition> = {
        chicken: PetDefs.CHICKEN,
        cow: PetDefs.COW,
        turtle: PetDefs.TURTLE,
        dino: PetDefs.DINO,
        duck: PetDefs.DUCK,
        raccoon: PetDefs.RACCOON,
        rabbit: PetDefs.RABBIT,
        parrot: PetDefs.PARROT,
        junimo: PetDefs.JUNIMO,
        dog: PetDefs.DOG,
        cat: PetDefs.CAT,
    };

    private animals: Array<{
        el: HTMLElement;
        config: SpriteDefinition;
        engine: SpriteEngine;
        x: number;
        y: number;
        state: 'idle' | 'walking' | 'reacting';
        direction: 'down' | 'left' | 'right' | 'up';
        idleTimer?: number;
        actionTimer?: number;
        walkRaf?: number;
        reactionTimer?: number;
        reactionEl?: HTMLElement;
        petId?: string;
    }> = [];

    addAnimal(container: Element, sprite: string, id: string, petId?: string) {
        const config = this.ANIMAL_CONFIG[sprite];
        if (!config) {
            console.warn(`No sprite config found for ${sprite}`);
            return;
        }

        const animal = container.createDiv({ cls: "stardew-animal", attr: { id } });
        const engine = new SpriteEngine(animal, config, (file) => this.getPluginResourcePath(file));

        const farmEl = container as HTMLElement;
        const fallbackSize = (config.frameSize && config.frameSize > 0) ? config.frameSize : 16;
        const maxX = Math.max(0, farmEl.clientWidth - fallbackSize * config.scale);
        const maxY = Math.max(0, farmEl.clientHeight - fallbackSize * config.scale);
        const startX = Math.random() * maxX;
        const startY = Math.random() * maxY;

        this.updateAnimalPosition(animal, startX, startY);
        animal.setCssProps({
            "--sprite-size": `${fallbackSize * config.scale}px`,
        });

        const animalState = {
            el: animal,
            config,
            engine,
            x: startX,
            y: startY,
            state: 'idle' as const,
            direction: 'down' as const,
            petId,
        };

        this.animals.push(animalState);
        this.registerDomEvent(animal, "click", (event) => {
            event.stopPropagation();
            if (this.removeMode && animalState.petId) {
                void this.removeSavedPet(animalState);
                return;
            }
            this.startReaction(animalState, farmEl);
        });

        engine.load().then(() => {
            const size = engine.getFrameSize() * config.scale;
            animal.setCssProps({
                "--sprite-size": `${size}px`,
            });
            const maxLoadedX = Math.max(0, farmEl.clientWidth - size);
            const maxLoadedY = Math.max(0, farmEl.clientHeight - size);
            animalState.x = Math.max(0, Math.min(maxLoadedX, animalState.x));
            animalState.y = Math.max(0, Math.min(maxLoadedY, animalState.y));
            this.updateAnimalPosition(animal, animalState.x, animalState.y);
        }).catch((err) => console.error(err));
    }

    spawnPet(name: string, specie: string, _color?: string) {
        this.spawnSavedPet({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            specie,
            color: _color ?? "",
        });
    }

    spawnSavedPet(pet: Pet) {
        const farm = this.contentEl.querySelector(".stardew-farm");
        if (!farm) return;
        const key = this.normalizeSpecieKey(pet.specie);
        if (!key) {
            console.warn(`Unknown pet specie: ${pet.specie}`);
            return;
        }
        const id = `${key}-${pet.name}-${pet.id}`;
        this.addAnimal(farm, key, id, pet.id);
        if (!this.animationsPaused) {
            const animal = this.animals[this.animals.length - 1];
            if (animal) this.startRest(animal);
        }
    }

    startAnimations() {
        this.animals.forEach(animal => this.startRest(animal));
    }

    private startRest(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'idle';
        animalState.engine.play("idle");
        const idleTime = Math.random() * 5000;
        animalState.idleTimer = window.setTimeout(() => this.startAction(animalState), idleTime);
    }

    private startAction(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        const doSleep = Math.random() < 0.3;
        if (doSleep) {
            this.startSleep(animalState);
        } else {
            this.startWalk(animalState);
        }
    }

    private startSleep(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'idle';
        animalState.engine.play("sleep");
        const sleepDuration = 3500 + Math.random() * 6500;
        animalState.actionTimer = window.setTimeout(() => this.startRest(animalState), sleepDuration);
    }

    private startWalk(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'walking';
        const farm = this.contentEl.querySelector('.stardew-farm') as HTMLElement;
        if (!farm) return;
        const padding = animalState.engine.getFrameSize() * animalState.config.scale;
        const maxX = Math.max(0, farm.clientWidth - padding);
        const maxY = Math.max(0, farm.clientHeight - padding);

        const targetX = Math.random() * maxX;
        const targetY = Math.random() * maxY;

        const dx = targetX - animalState.x;
        const dy = targetY - animalState.y;

        const segments: Array<{
            dx: number;
            dy: number;
            direction: 'down' | 'left' | 'right' | 'up';
            distance: number;
        }> = [];

        const canX = Math.abs(dx) > 1;
        const canY = Math.abs(dy) > 1;
        if (canX && canY) {
            const useTwoSegments = Math.random() < 0.5;
            const firstHorizontal = Math.random() < 0.5;
            if (useTwoSegments) {
                if (firstHorizontal) {
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                } else {
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                }
            } else {
                const goHorizontal = Math.random() < 0.5;
                if (goHorizontal) {
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                } else {
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                }
            }
        } else if (canX) {
            segments.push({
                dx,
                dy: 0,
                direction: dx > 0 ? 'right' : 'left',
                distance: Math.abs(dx),
            });
        } else if (canY) {
            segments.push({
                dx: 0,
                dy,
                direction: dy > 0 ? 'down' : 'up',
                distance: Math.abs(dy),
            });
        }

        if (!segments.length) {
            this.startRest(animalState);
            return;
        }

        const speed = 30; // pixels per second

        const walkSegment = (index: number) => {
            if (index >= segments.length) {
                this.startRest(animalState);
                return;
            }

            const segment = segments[index]!;
            animalState.direction = segment.direction;
            animalState.engine.play(this.getMoveAnimName(animalState.direction));

            const duration = Math.max(200, (segment.distance / speed) * 1000);
            const startX = animalState.x;
            const startY = animalState.y;
            const startTime = performance.now();

            const step = (timestamp: number) => {
                if (this.animationsPaused) return;
                const elapsed = timestamp - startTime;
                const progress = Math.min(1, elapsed / duration);
                const nextX = startX + segment.dx * progress;
                const nextY = startY + segment.dy * progress;
                animalState.x = Math.max(0, Math.min(maxX, nextX));
                animalState.y = Math.max(0, Math.min(maxY, nextY));
                this.updateAnimalPosition(animalState.el, animalState.x, animalState.y);

                if (progress < 1) {
                    animalState.walkRaf = requestAnimationFrame(step);
                } else {
                    walkSegment(index + 1);
                }
            };

            animalState.walkRaf = requestAnimationFrame(step);
        };

        walkSegment(0);
    }

    private startReaction(animalState: typeof this.animals[number], farm: HTMLElement) {
        if (this.animationsPaused) return;
        this.clearAnimalTimers(animalState);
        this.removeReaction(animalState);

        animalState.state = "reacting";
        animalState.engine.play("special");
        animalState.reactionEl = this.createReactionBubble(farm, animalState);
        animalState.el.setCssProps({
            "z-index": `${Math.round(animalState.y) + 10000}`,
        });

        const specialDuration = animalState.engine.getAnimationDurationMs("special");
        const reactionDuration = Math.max(1200, specialDuration ?? 1200);
        animalState.reactionTimer = window.setTimeout(() => {
            animalState.reactionTimer = undefined;
            this.removeReaction(animalState);
            this.updateAnimalPosition(animalState.el, animalState.x, animalState.y);
            this.startRest(animalState);
        }, reactionDuration);
    }

    private createReactionBubble(farm: HTMLElement, animalState: typeof this.animals[number]) {
        const bubble = farm.createDiv({ cls: "stardew-reaction-bubble" });
        bubble.createDiv({ cls: "stardew-pixel-heart" });
        const size = animalState.engine.getFrameSize() * animalState.config.scale;
        bubble.setCssProps({
            left: `${animalState.x + size / 2}px`,
            top: `${Math.max(0, animalState.y + size * -0.15)}px`,
            "z-index": `${Math.round(animalState.y) + 10001}`,
        });
        return bubble;
    }

    async onClose() {
        this.pauseAnimations();
        this.animals.forEach(animal => this.removeReaction(animal));
        this.animals = [];
    }

    private pauseAnimations() {
        if (this.animationsPaused) return;
        this.animationsPaused = true;
        this.animals.forEach(animal => {
            this.clearAnimalTimers(animal);
            this.removeReaction(animal);
            animal.engine.stop();
        });
    }

    private resumeAnimations() {
        if (!this.animationsPaused) return;
        this.animationsPaused = false;
        this.animals.forEach(animal => this.startRest(animal));
    }

    private getMoveAnimName(direction: 'down' | 'left' | 'right' | 'up') {
        switch (direction) {
            case "down":
                return "moveDown";
            case "left":
                return "moveLeft";
            case "right":
                return "moveRight";
            case "up":
                return "moveUp";
            default:
                return "moveDown";
        }
    }

    private normalizeSpecieKey(specie: string): string | null {
        const key = specie.trim().toLowerCase();
        if (key in this.ANIMAL_CONFIG) return key;
        return null;
    }

    private getPetSpecies() {
        return Object.keys(this.ANIMAL_CONFIG);
    }

    private async removeSavedPet(animalState: typeof this.animals[number]) {
        if (!animalState.petId) return;
        this.clearAnimalTimers(animalState);
        this.removeReaction(animalState);
        animalState.engine.stop();
        animalState.el.remove();
        this.animals = this.animals.filter((animal) => animal !== animalState);
        await this.actions.removePet(animalState.petId);
    }

    private updateAnimalPosition(animal: HTMLElement, x: number, y: number) {
        animal.setCssProps({
            left: `${x}px`,
            top: `${y}px`,
            "z-index": `${Math.round(y)}`,
        });
    }

    private clearAnimalTimers(animalState: typeof this.animals[number]) {
        if (animalState.idleTimer) window.clearTimeout(animalState.idleTimer);
        if (animalState.actionTimer) window.clearTimeout(animalState.actionTimer);
        if (animalState.walkRaf) cancelAnimationFrame(animalState.walkRaf);
        if (animalState.reactionTimer) window.clearTimeout(animalState.reactionTimer);
        animalState.idleTimer = undefined;
        animalState.actionTimer = undefined;
        animalState.walkRaf = undefined;
        animalState.reactionTimer = undefined;
    }

    private removeReaction(animalState: typeof this.animals[number]) {
        animalState.reactionEl?.remove();
        animalState.reactionEl = undefined;
    }

    private getPluginResourcePath(file: string) {
        return resolveSpriteAsset(file);
    }
}

class AddPetModal extends Modal {
    private name = "";
    private specie: string;

    constructor(
        app: StardewView["app"],
        private species: string[],
        private onSubmit: (pet: Omit<Pet, "id">) => Promise<void>,
    ) {
        super(app);
        this.specie = species[0] ?? "cat";
    }

    onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("stardew-pet-modal");
        this.titleEl.setText("Add pet");

        new Setting(this.contentEl)
            .setName("Name")
            .addText((text) => {
                text.setPlaceholder("Miso");
                text.onChange((value) => {
                    this.name = value;
                });
            });

        new Setting(this.contentEl)
            .setName("Pet")
            .addDropdown((dropdown) => {
                for (const specie of this.species) {
                    dropdown.addOption(specie, this.formatSpeciesName(specie));
                }
                dropdown.setValue(this.specie);
                dropdown.onChange((value) => {
                    this.specie = value;
                });
            });

        const actions = this.contentEl.createDiv({ cls: "stardew-modal-actions" });
        actions.createEl("button", { text: "Cancel", attr: { type: "button" } }, (button) => {
            button.addEventListener("click", () => this.close());
        });
        actions.createEl("button", {
            cls: "mod-cta",
            text: "Add pet",
            attr: { type: "button" },
        }, (button) => {
            button.addEventListener("click", () => void this.submit());
        });
    }

    private async submit() {
        const name = this.name.trim();
        if (!name) {
            new Notice("Name your pet first.");
            return;
        }
        await this.onSubmit({
            name,
            specie: this.specie,
            color: "",
        });
        this.close();
    }

    private formatSpeciesName(specie: string) {
        return specie.charAt(0).toUpperCase() + specie.slice(1);
    }
}
