import {Starter as StarterClass} from "../window/base/Starter";
import {registry} from "./WindowsRegistry";

export let Starter = new StarterClass();
registry.forEach(x => {
    Starter.objectFactory.registerByName(x.className, x.clazz);
});