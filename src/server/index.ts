import amqp from "amqplib";
import node from "node:process";
// import { process } from "node:process";

async function main() {
  console.log("Starting Peril server...");

  const connectionString = "amqp://guest:guest@localhost:5672/";
  const amqpConnection = await amqp.connect(connectionString);

  if (!amqpConnection) {
    throw new Error("Error establishing connection to AMQP server")
  }
  console.log("Established connection with AMQP server")
  
  process.on('exit', () => {
  console.log('Closing AMQP server connection');
});
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});