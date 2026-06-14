import "./style.css";
import { Engine } from "./core/Engine";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const engine = new Engine(app);
engine.start();
