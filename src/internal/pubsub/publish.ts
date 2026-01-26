import type { ConfirmChannel, Channel} from "amqplib";
import amqp from "amqplib";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
 const content = Buffer.from(JSON.stringify(value));

  return new Promise((resolve, reject) => {
    ch.publish(
      exchange,
      routingKey,
      content,
      { contentType: "application/json" },
      (err) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        } else {
          resolve();
        }
      },
    );
  });
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createConfirmChannel();

  let queue: amqp.Replies.AssertQueue = {
    queue: "",
    messageCount: 0,
    consumerCount: 0
  }
  if (queueType === "durable") {
    queue = await ch.assertQueue(queueName, {durable: true, autoDelete: false, exclusive: false})
  } else if (queueType === "transient") {
    queue = await ch.assertQueue(queueName, {durable: false, autoDelete: true, exclusive: true})
  }
  
  if (queue) {
    await ch.bindQueue(queue.queue, exchange, key)
    return [ch, queue]
  } else {
    throw new Error("Invalid queue")
  }
};