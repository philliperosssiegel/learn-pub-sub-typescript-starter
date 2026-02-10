import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, getMaliciousLog, printQuit, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import type { GameLog } from "../internal/gamelogic/logs.js";

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
  const gs = new GameState(username);
  const publishCh = await conn.createConfirmChannel();

  await subscribeJSON(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(gs));
  await subscribeJSON(conn, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, `${ArmyMovesPrefix}.*`, SimpleQueueType.Transient, handlerMove(gs, publishCh));
  await subscribeJSON(conn, ExchangePerilTopic, `${WarRecognitionsPrefix}`, `${WarRecognitionsPrefix}.#`, SimpleQueueType.Durable, handlerWar(gs, publishCh));

  const loop = true;
  while (loop) {
    const input = await getInput();
    if (input.length !== 0) {
      const command = input[0];
      switch (command) {
        case "spawn":
          try {
            commandSpawn(gs, input)
          } catch (err) {
            console.log((err as Error).message);
          }
        break;
        case "move":
          try {
            const move = commandMove(gs, input);
            await publishJSON(publishCh, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, move);
          } catch (err) {
            console.log((err as Error).message);
          }
          break;
        case "status":
          commandStatus(gs);
          break;
        case "help":
          printServerHelp();
          break;
        case "spam":
          if (input.length < 2) {
            console.log("usage: spam <n>");
            continue;
          }
          const raw = input[1];
          if (!raw) {
            console.log("usage: spam <n>");
            continue;
          }
          const n = parseInt(raw, 10);
          if (isNaN(n)) {
            console.log(`error: ${input[1]} is not a valid number`);
            continue;
          }
          for (let i = 0; i < n; i++) {
            try {
              publishGameLog(publishCh, gs.getUsername(), getMaliciousLog());
            } catch (err) {
              console.error(
                "Failed to publish spam message:",
                (err as Error).message,
              );
              continue;
            }
          }
          console.log(`Published ${n} malicious logs`);
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

export async function publishGameLog(channel: amqp.ConfirmChannel, username: string, message: string): Promise<void> {
  const gameLog: GameLog = {
    currentTime: new Date(),
    message: message,
    username: username
  }

  return publishMsgPack(channel, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);
};