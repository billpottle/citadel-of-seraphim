import "./styles.css";
import { CitadelGame } from "./game/CitadelGame";

const root = document.querySelector<HTMLDivElement>("#game-root");
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button");

if (!root) {
  throw new Error("Missing #game-root");
}

const game = new CitadelGame(root);

async function bootstrap() {
  await game.start();

  restartButton?.addEventListener("click", (event) => {
    event.preventDefault();
    game.restart();
  });

}

void bootstrap();
