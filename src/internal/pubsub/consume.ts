import amqp, { type Channel } from "amqplib";
import { DeadLetterExchangeName } from "../routing/routing.js";
import { decode } from "@msgpack/msgpack";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();

  const queue = await ch.assertQueue(queueName, {
    durable: queueType === SimpleQueueType.Durable,
    exclusive: queueType !== SimpleQueueType.Durable,
    autoDelete: queueType !== SimpleQueueType.Durable,
    arguments: {"x-dead-letter-exchange": DeadLetterExchangeName}
  });

  await ch.bindQueue(queue.queue, exchange, key);
  return [ch, queue];
}

export enum AckType {
    Ack,
    NackDiscard,
    NackRequeue
};

// export async function subscribeJSON<T>(
//   conn: amqp.ChannelModel,
//   exchange: string,
//   queueName: string,
//   key: string,
//   queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
//   handler: (data: T) => Promise<AckType> | AckType,
// ): Promise<void> {
//     const [ch, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
//     await ch.consume(queue.queue, 
//         async (message: amqp.ConsumeMessage | null) => {
//             if (!message) return;

//             let data: T;
//             try {
//                 data = JSON.parse(message.content.toString());
//             } catch (err) {
//                 console.error("Could not unmarshal message:", err);
//                 return;
//             }
//             try {
//                 const result = await handler(data);
                
//                 switch (result) {
//                     case AckType.Ack:
//                         ch.ack(message);
//                         break;
//                     case AckType.NackRequeue:
//                         ch.nack(message, false, true);
//                         break;
//                     case AckType.NackDiscard:
//                         ch.nack(message, false, false);
//                         break;
//                     default:
//                         const unreachable: never = result;
//                         console.error("Unexpected ack type:", unreachable)
//                 }
//             } catch (err) {
//                 console.error("Error handling message:", err);
//                 ch.nack(message, false, false);
//                 return;
//             }
//         })
// };

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
    return subscribe(conn, exchange, queueName, key, queueType, handler, (buf: Buffer) => JSON.parse(buf.toString()) as T);
};

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
    return subscribe(conn, exchange, queueName, key, queueType, handler, (buf: Buffer) => decode(new Uint8Array(buf)) as T);
};

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
    const [ch, queue] = await declareAndBind(conn, exchange, queueName, routingKey, simpleQueueType);
    await ch.consume(queue.queue, 
        async (message: amqp.ConsumeMessage | null) => {
            if (!message) return;

            let data: T;
            try {
                data = unmarshaller(message.content)
            } catch (err) {
                console.error("Could not unmarshal message:", err);
                return;
            }
            try {
                const result = await handler(data);
                
                switch (result) {
                    case AckType.Ack:
                        ch.ack(message);
                        break;
                    case AckType.NackRequeue:
                        ch.nack(message, false, true);
                        break;
                    case AckType.NackDiscard:
                        ch.nack(message, false, false);
                        break;
                    default:
                        const unreachable: never = result;
                        console.error("Unexpected ack type:", unreachable)
                }
            } catch (err) {
                console.error("Error handling message:", err);
                ch.nack(message, false, false);
                return;
            }
        },
    {noAck: false}
    )
};