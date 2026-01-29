import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printQuit, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerPause } from "./handlers.js";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game client connected to RabbitMQ!");

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();

  await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );
  
  const gameState = new GameState(username);
  await subscribeJSON(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(gameState));

  const loop = true;
  while (loop) {
    const input = await getInput();
    if (input.length !== 0) {
      const command = input[0];
      switch (command) {
        case "spawn":
          try {
            commandSpawn(gameState, input)
          } catch (err) {
            console.log((err as Error).message);
          }
        break;
        case "move":
          try {
            commandMove(gameState, input);
          } catch (err) {
            console.log((err as Error).message);
          }         
          break;
        case "status":
          commandStatus(gameState);
          break;
        case "help":
          printServerHelp();
          break;
        case "spam":
          console.log("Spamming not allowed yet!");
          break;
        case "quit":
          printQuit();
          process.exit(0);
        default:
          console.log("Invalid input");
          break;
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
