import express from "express";
import fetch from "node-fetch";
import { createEvents } from "ics";

const app = express();
const PORT = process.env.PORT || 3000;

export interface EventAttributes {
  title: string;
  start: [number, number, number, number, number]; // [Y, M, D, H, M]
  end: [number, number, number, number, number];
  location?: string;
  description?: string;
}

interface UniEvent {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  courseName: string;
  lecturer: string;
  room?: string;
  info?: string;
}

/**
 * Fetch events from FH Kufstein API
 */
async function fetchEvents(
  startDate: string,
  endDate: string,
  pkz: string
): Promise<UniEvent[]> {
  const url = `https://fhapp.fh-kufstein.ac.at/api/infoboard?from=${startDate}&until=${endDate}&ending=pkz=${pkz}&impersonating=null`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error fetching events: ${response.status}`);
  }

  const json = (await response.json()) as { data: UniEvent[] };
  return json.data;
}

/**
 * Convert events to ICS format
 */
function transformToIcs(events: UniEvent[]): string {
  const icsEvents: EventAttributes[] = events.map((ev) => {
    const [year, month, day] = ev.date.split("-").map(Number);
    const [sh, sm] = ev.startTime.split(":").map(Number);
    const [eh, em] = ev.endTime.split(":").map(Number);

    return {
      title: ev.courseName,
      start: [year, month, day, sh, sm],
      end: [year, month, day, eh, em],
      location: ev.room || "",
      description: `${ev.courseName} | Lecturer: ${ev.lecturer} | Info: ${
        ev.info || ""
      }`,
    };
  });

  const { error, value } = createEvents(icsEvents);
  if (error || !value) {
    console.error("ICS generation error:", error);
    throw error;
  }
  return value;
}

/**
 * Route: GET /calendar/<pkz>.ics
 * Serves the ICS file for a given student (pkz)
 */
app.get("/calendar/:pkz.ics", async (req, res) => {
  const { pkz } = req.params;

  // date range → today until +12 months
  const today = new Date();
  const startDate = today.toLocaleDateString("de-DE"); // DD.MM.YYYY
  const end = new Date(today);
  end.setMonth(end.getMonth() + 12);
  const endDate = end.toLocaleDateString("de-DE");

  try {
    const events = await fetchEvents(startDate, endDate, pkz);
    const icsContent = transformToIcs(events);

    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename="${pkz}.ics"`);
    res.send(icsContent);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to generate calendar");
  }
});

app.listen(PORT, () => {
  console.log(`📅 Calendar server running on http://localhost:${PORT}`);
});
