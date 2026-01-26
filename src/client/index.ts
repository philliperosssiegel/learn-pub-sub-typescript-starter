import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey} from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Peril game server connected to RabbitMQ!");

  const username = await clientWelcome()
  await declareAndBind(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, "transient")
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
