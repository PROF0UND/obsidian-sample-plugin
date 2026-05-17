import dirtBackground from "../sprites/backgrounds/dirt.png";
import grassBackground from "../sprites/backgrounds/grass.png";
import grassFallBackground from "../sprites/backgrounds/grass_fall.png";
import sandBackground from "../sprites/backgrounds/sand.png";
import snowBackground from "../sprites/backgrounds/snow.png";
import woodBrokenBackground from "../sprites/backgrounds/wood_broken.png";
import woodDarkBackground from "../sprites/backgrounds/wood_dark.png";
import woodLightBackground from "../sprites/backgrounds/wood_light.png";
import woodOrangeBackground from "../sprites/backgrounds/wood_orange.png";
import catPet from "../sprites/pets/cat.png";
import chickenPet from "../sprites/pets/chicken.png";
import cowPet from "../sprites/pets/cow.png";
import dinoPet from "../sprites/pets/dino.png";
import dogPet from "../sprites/pets/dog.png";
import duckPet from "../sprites/pets/duck.png";
import goatPet from "../sprites/pets/goat.png";
import junimoPet from "../sprites/pets/junimo.png";
import ostrichPet from "../sprites/pets/ostrich.png";
import parrotPet from "../sprites/pets/parrot.png";
import pigPet from "../sprites/pets/pig.png";
import rabbitPet from "../sprites/pets/rabbit.png";
import raccoonPet from "../sprites/pets/raccoon.png";
import sheepPet from "../sprites/pets/sheep.png";
import turtlePet from "../sprites/pets/turtle.png";
import axeUi from "../sprites/ui/axe.png";
import ballUi from "../sprites/ui/ball.png";
import giftUi from "../sprites/ui/gift.png";
import houseUi from "../sprites/ui/house.png";
import menuUi from "../sprites/ui/menu.png";
import pickaxeUi from "../sprites/ui/pickaxe.png";
import treeUi from "../sprites/ui/tree.png";

const SPRITE_ASSETS: Record<string, string> = {
    "sprites/backgrounds/dirt.png": dirtBackground,
    "sprites/backgrounds/grass.png": grassBackground,
    "sprites/backgrounds/grass_fall.png": grassFallBackground,
    "sprites/backgrounds/sand.png": sandBackground,
    "sprites/backgrounds/snow.png": snowBackground,
    "sprites/backgrounds/wood_broken.png": woodBrokenBackground,
    "sprites/backgrounds/wood_dark.png": woodDarkBackground,
    "sprites/backgrounds/wood_light.png": woodLightBackground,
    "sprites/backgrounds/wood_orange.png": woodOrangeBackground,
    "sprites/pets/cat.png": catPet,
    "sprites/pets/chicken.png": chickenPet,
    "sprites/pets/cow.png": cowPet,
    "sprites/pets/dino.png": dinoPet,
    "sprites/pets/dog.png": dogPet,
    "sprites/pets/duck.png": duckPet,
    "sprites/pets/goat.png": goatPet,
    "sprites/pets/junimo.png": junimoPet,
    "sprites/pets/ostrich.png": ostrichPet,
    "sprites/pets/parrot.png": parrotPet,
    "sprites/pets/pig.png": pigPet,
    "sprites/pets/rabbit.png": rabbitPet,
    "sprites/pets/raccoon.png": raccoonPet,
    "sprites/pets/sheep.png": sheepPet,
    "sprites/pets/turtle.png": turtlePet,
    "sprites/ui/axe.png": axeUi,
    "sprites/ui/ball.png": ballUi,
    "sprites/ui/gift.png": giftUi,
    "sprites/ui/house.png": houseUi,
    "sprites/ui/menu.png": menuUi,
    "sprites/ui/pickaxe.png": pickaxeUi,
    "sprites/ui/tree.png": treeUi,
};

export function resolveSpriteAsset(path: string): string {
    const normalizedPath = path.replace(/\\/g, "/");
    const asset = SPRITE_ASSETS[normalizedPath];
    if (!asset) {
        throw new Error(`Missing bundled sprite asset: ${path}`);
    }
    return asset;
}
