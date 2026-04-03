const TURN_USER = process.env.TURN_USER || "000000002089032158";
const TURN_PASS = process.env.TURN_PASS || "7zR/SIT0zH0aURcrLTNIalplyO0=";
const METERED_DOMAIN = process.env.METERED_DOMAIN || "hongda.metered.live";
const METERED_SECRET = process.env.METERED_SECRET || "";

function fallbackICE() {
  return [
    {
      urls: `turn:${METERED_DOMAIN}:80`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turn:${METERED_DOMAIN}:443`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turn:${METERED_DOMAIN}:443?transport=tcp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
}

export async function GET() {
  if (METERED_SECRET) {
    try {
      const resp = await fetch(
        `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_SECRET}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const iceServers = Array.isArray(data)
          ? data
          : data.iceServers || fallbackICE();
        return Response.json(
          { iceServers },
          {
            headers: { "Cache-Control": "public, max-age=3600" },
          }
        );
      }
    } catch {
      // fall through to fallback
    }
  }

  return Response.json(
    { iceServers: fallbackICE() },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
