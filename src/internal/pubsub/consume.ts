import amqp, { type Channel } from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();

  const queue = await ch.assertQueue(queueName, {
    durable: queueType === SimpleQueueType.Durable,
    exclusive: queueType !== SimpleQueueType.Durable,
    autoDelete: queueType !== SimpleQueueType.Durable,
  });

  await ch.bindQueue(queue.queue, exchange, key);
  return [ch, queue];
}

export type Acktype = "Ack" | "NackRequeue" | "NackDiscard";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Acktype,
): Promise<void> {
    const [ch, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
    await ch.consume(queue.queue, 
        (message: amqp.ConsumeMessage | null) => {
            if (!message) return;

            let data: T;
            try {
                data = JSON.parse(message.content.toString());
            } catch (err) {
                console.error("Could not unmarshal message:", err);
                return;
            }
            try {
                const acktype_return = handler(data);
                
                switch (acktype_return) {
                    case "Ack":
                        ch.ack(message);
                        console.log("Ack");
                        break;
                    case "NackRequeue":
                        ch.nack(message, false, true);
                        console.log("NackRequeue");
                        break;
                    case "NackDiscard":
                        ch.nack(message, false, false);
                        console.log("NackDiscard");
                        break;
                }
            } catch (err) {
                console.error("Error handling message:", err);
                ch.nack(message, false, false);
            }
        })
};