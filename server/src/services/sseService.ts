import { Response } from 'express';

interface SSEClient {
  id: string;
  response: Response;
  role: string;
  userId: string;
}

class SSEService {
  private clients: SSEClient[] = [];

  public addClient(id: string, response: Response, role: string, userId: string) {
    this.clients.push({ id, response, role, userId });
    
    // Send initial connection message
    response.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Real-time updates active' })}\n\n`);
  }

  public removeClient(id: string) {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  public broadcastEvent(type: string, data: any) {
    const payload = JSON.stringify({ type, data });
    this.clients.forEach(client => {
      try {
        client.response.write(`data: ${payload}\n\n`);
      } catch (error) {
        // Client might have disconnected
        this.removeClient(client.id);
      }
    });
  }
}

export const sseService = new SSEService();
