// In-memory room store (works for single-instance dev/demo)
// For production, use Redis/Upstash

interface RoomClient {
  id: string;
  controller: ReadableStreamDefaultController;
  lastSeen: number;
}

interface RoomMessage {
  data: string;
  from: string;
  ts: number;
}

const rooms = new Map<string, {
  clients: Map<string, RoomClient>;
  messages: RoomMessage[];
}>();

// Cleanup stale clients every 30s
if (typeof globalThis !== 'undefined') {
  (globalThis as Record<string, unknown>).__roomCleanup ??= setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
      room.clients.forEach((client, clientId) => {
        if (now - client.lastSeen > 60000) {
          try { client.controller.close(); } catch {}
          room.clients.delete(clientId);
          // Broadcast leave
          const leaveMsg = JSON.stringify({ _sys: "left", _id: clientId });
          room.clients.forEach((c) => {
            try { c.controller.enqueue(`data: ${leaveMsg}\n\n`); } catch {}
          });
        }
      });
      if (room.clients.size === 0 && now - Math.max(...room.messages.map(m => m.ts), 0) > 300000) {
        rooms.delete(roomId);
      }
    });
  }, 30000);
}

function getRoom(roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { clients: new Map(), messages: [] });
  }
  return rooms.get(roomId)!;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// SSE endpoint - GET /api/room?r=<roomHash>
export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("r");
  if (!roomId) {
    return new Response("Missing room id", { status: 400 });
  }

  const clientId = generateId();
  const room = getRoom(roomId);

  const stream = new ReadableStream({
    start(controller) {
      // Register client
      room.clients.set(clientId, {
        id: clientId,
        controller,
        lastSeen: Date.now(),
      });

      // Send welcome with list of existing clients
      const existingClients = Array.from(room.clients.keys()).filter(id => id !== clientId);
      const welcome = JSON.stringify({ 
        _sys: "welcome", 
        _id: clientId,
        _existingCount: existingClients.length
      });
      controller.enqueue(`data: ${welcome}\n\n`);

      // Notify existing clients that a new client joined
      const joinMsg = JSON.stringify({ _sys: "joined", _id: clientId });
      room.clients.forEach((c, cid) => {
        if (cid !== clientId) {
          try { c.controller.enqueue(`data: ${joinMsg}\n\n`); } catch {}
        }
      });

      // Send recent messages (offline sync)
      const recent = room.messages.slice(-50);
      recent.forEach((msg) => {
        try {
          controller.enqueue(`data: ${msg.data}\n\n`);
        } catch {}
      });

      if (recent.length > 0) {
        const done = JSON.stringify({ _sys: "offline_done", count: recent.length });
        controller.enqueue(`data: ${done}\n\n`);
      }
    },
    cancel() {
      room.clients.delete(clientId);
      // Broadcast leave
      const leaveMsg = JSON.stringify({ _sys: "left", _id: clientId });
      room.clients.forEach((c) => {
        try { c.controller.enqueue(`data: ${leaveMsg}\n\n`); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Client-Id": clientId,
    },
  });
}

// Send message - POST /api/room
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, clientId, data } = body;

    if (!roomId || !data) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const room = getRoom(roomId);

    // Update client lastSeen
    if (clientId && room.clients.has(clientId)) {
      room.clients.get(clientId)!.lastSeen = Date.now();
    }

    // Handle ping
    if (data._ping) {
      return Response.json({ _pong: true });
    }

    // Store message
    const msg: RoomMessage = {
      data: JSON.stringify({ _data: data, _from: clientId }),
      from: clientId || "unknown",
      ts: Date.now(),
    };
    room.messages.push(msg);

    // Trim old messages
    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-100);
    }

    // Rate limiting (simple)
    // Broadcast to all clients
    const envelope = msg.data;
    room.clients.forEach((client) => {
      try {
        client.controller.enqueue(`data: ${envelope}\n\n`);
      } catch {}
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
