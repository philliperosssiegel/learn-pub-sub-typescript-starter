import amqp from "amqplib";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js"
import { publishJSON } from "../internal/pubsub/publish.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume.js";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game server connected to RabbitMQ!");

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

  const publishCh = await conn.createConfirmChannel();

  await declareAndBind(
      conn,
      ExchangePerilTopic,
      GameLogSlug,
      `${GameLogSlug}.*`,
      SimpleQueueType.Durable,
    );

  printServerHelp();

  let loop = true;
  while (loop) {
    const input = await getInput();
    if (input.length !== 0) {
      const command = input[0];
      switch (command) {
        case "pause":
          console.log("Publishing paused game state");
          try {
            await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
                isPaused: true,
              });
          } catch (err) {
            console.error("Error publishing pause message:", err);
          }
          break;
        case "resume":
          console.log("Publishing resumed game state")
          try {
            await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
                isPaused: false,
              });
          } catch (err) {
            console.error("Error publishing resume message:", err);
          }
          break;
        case "quit":
          console.log("Exiting server")
          process.exit(0)
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