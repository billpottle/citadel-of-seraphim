import "./styles.css";
import { CitadelGame } from "./game/CitadelGame";

const root = document.querySelector<HTMLDivElement>("#game-root");

if (!root) {
  throw new Error("Missing #game-root");
}

const game = new CitadelGame(root);

async function bootstrap() {
  await game.start();
}

void bootstrap();
