import { EventEmitter } from "node:events";

// NOTE: This in-memory event bus is single-instance only. In a multi-replica or
// horizontally scaled deployment, replace or back this with Redis Pub/Sub.
class PipelineEventBus extends EventEmitter {
  constructor(maxRecent = 50) {
    super();
    this.maxRecent = maxRecent;
    this.recentEvents = [];
  }

  broadcast(event) {
    const enriched = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.recentEvents.unshift(enriched);
    if (this.recentEvents.length > this.maxRecent) {
      this.recentEvents.pop();
    }

    this.emit("pipeline_event", enriched);
    if (enriched.eventName) {
      this.emit(enriched.eventName, enriched);
    }
    return enriched;
  }

  getRecent(limit = 20) {
    return this.recentEvents.slice(0, limit);
  }
}

export const eventBus = new PipelineEventBus();
