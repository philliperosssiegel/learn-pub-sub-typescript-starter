import amqp from "amqplib";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js"
import { publishJSON } from "../internal/pubsub/publish.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game server connected to RabbitMQ!");

  const confirmChannel = await conn.createConfirmChannel();

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

  // try {
  //   const state: PlayingState = {
  //     isPaused: true,
  //   };
  //   await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, state);
  // } catch (err) {
  //   console.error("Error publishing message:", err);
  // }

  printServerHelp();

  let loop = true;
  while (loop) {
    const input = await getInput();
    if (input.length !== 0) {
      switch (input[0]) {
        case "pause":
          console.log("Sending a pause message");
          await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, {isPaused: true});
          break;
        case "resume":
          console.log("Sending a resume message")
          await publishJSON(confirmChannel, ExchangePerilDirect, PauseKey, {isPaused: false});
          break;
        case "quit":
          console.log("Exiting server")
          loop = false;
          break;
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