import type { ConfirmChannel } from "amqplib";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const content = JSON.stringify(value);
  const contentBuffer = Buffer.from(content); 
  ch.publish(exchange, routingKey, contentBuffer, {"contentType": "application/json"})
  return Promise.resolve();
};