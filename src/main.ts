import { Plugin } from 'obsidian';
import { FarmDecoration, Pet, StardewView, VIEW_TYPE_STARDEW } from './stardew-view';

//Save
class Save {
    public pets: Array<Pet> = new Array<Pet>();
    public decorations: Array<FarmDecoration> = new Array<FarmDecoration>();
}

let save = new Save();

export default class StardewPetsPlugin extends Plugin {
    async onload() {
        // Load save data
        await this.loadGame();

        // Register the Stardew view
        this.registerView(VIEW_TYPE_STARDEW, (leaf) => {
            return new StardewView(leaf, {
                getPets: () => save.pets,
                getDecorations: () => save.decorations,
                addPet: async (pet) => this.addPet(pet),
                removePet: async (id) => this.removePet(id),
                addDecoration: async (decoration) => this.addDecoration(decoration),
                updateDecoration: async (decoration) => this.updateDecoration(decoration),
                removeDecoration: async (id) => this.removeDecoration(id),
            });
        });

        // Command to open Stardew view
        this.addCommand({
            id: 'open-stardew-view',
            name: 'Open stardew farm',
            callback: async () => {
                const leaf = this.app.workspace.getLeftLeaf(true);
                if (!leaf) {
                    return;
                }
                await leaf.setViewState({ type: VIEW_TYPE_STARDEW, active: true });
                await this.app.workspace.revealLeaf(leaf);
            }

        });

    }

    onunload() {
        // Save game
        void this.saveGame().catch((err) => {
            console.error('Failed to save game on unload', err);
        });
    }

    async loadGame() {
        const data = await this.loadData();
        if (data && data.pets) {
            save.pets = data.pets.map((pet: Partial<Pet>) => ({
                id: pet.id ?? this.createPetId(),
                name: pet.name ?? "Pet",
                specie: pet.specie ?? "cat",
                color: pet.color ?? "",
            }));
        }
        if (data && data.decorations) {
            save.decorations = data.decorations.map((decoration: Partial<FarmDecoration>) => ({
                id: decoration.id ?? this.createPetId(),
                presetKey: decoration.presetKey ?? "",
                x: decoration.x ?? 0,
                y: decoration.y ?? 0,
            })).filter((decoration: FarmDecoration) => decoration.presetKey);
        }
    }

    async saveGame() {
        await this.saveData(save);
    }

    async addPet(pet: Omit<Pet, "id">) {
        const savedPet = {
            ...pet,
            id: this.createPetId(),
        };
        save.pets.push(savedPet);
        await this.saveGame();
        this.getStardewView()?.spawnSavedPet(savedPet);
    }

    async removePet(id: string) {
        save.pets = save.pets.filter((pet) => pet.id !== id);
        await this.saveGame();
    }

    async addDecoration(decoration: Omit<FarmDecoration, "id">) {
        const savedDecoration = {
            ...decoration,
            id: this.createPetId(),
        };
        save.decorations.push(savedDecoration);
        await this.saveGame();
        this.getStardewView()?.spawnSavedDecoration(savedDecoration);
    }

    async updateDecoration(decoration: FarmDecoration) {
        save.decorations = save.decorations.map((savedDecoration) => (
            savedDecoration.id === decoration.id ? decoration : savedDecoration
        ));
        await this.saveGame();
    }

    async removeDecoration(id: string) {
        save.decorations = save.decorations.filter((decoration) => decoration.id !== id);
        await this.saveGame();
    }

    private createPetId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private getStardewView(): StardewView | null {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_STARDEW)[0];
        if (!leaf) {
            return null;
        }
        const view = leaf.view;
        return view instanceof StardewView ? view : null;
    }
}
