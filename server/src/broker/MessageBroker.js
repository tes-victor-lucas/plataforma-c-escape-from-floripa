/** Broker em memória usado para desacoplar transporte, lobby e partida. */
export class MessageBroker {
    #subscribers = new Map();

    subscribe(topic, handler) {
        const handlers = this.#subscribers.get(topic) ?? new Set();
        handlers.add(handler);
        this.#subscribers.set(topic, handlers);
        return () => handlers.delete(handler);
    }

    publish(topic, payload) {
        for (const handler of this.#subscribers.get(topic) ?? []) {
            handler(payload);
        }
    }
}
