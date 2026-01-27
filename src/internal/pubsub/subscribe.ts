import amqp from "amqplib";
import { declareAndBind, type SimpleQueueType } from "./consume.js";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => void,
): Promise<void> {
    const [ch, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
    await ch.consume(queue.queue, 
        (message: amqp.ConsumeMessage | null) => {
            if (message === null){
                return;
            } else {
                const content = JSON.parse(message.content.toString());
                handler(content);
                ch.ack(message)
            }
        })
};