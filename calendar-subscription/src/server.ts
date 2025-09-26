import express from "express";
import type { Request, Response } from "express";
import fetch from "node-fetch";
import { ICalCalendar } from "ical-generator";
import moment from "moment-timezone";

const app = express();
const PORT = process.env.PORT || 3000;

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
 * Transform API events into ICS calendar with Europe/Vienna TZ
 */
function createCalendar(events: UniEvent[], pkz: string): ICalCalendar {
  const calendar = new ICalCalendar({
    name: `FH Kufstein (${pkz})`,
    timezone: "Europe/Vienna", // ensures correct CET/CEST handling
    prodId: {
      company: "joscha0/fhkufstein-tools",
      product: "calendar-subscription",
    },
  });

  for (const ev of events) {
    const start = moment.tz(
      `${ev.date} ${ev.startTime}`,
      "YYYY-MM-DD HH:mm",
      "Europe/Vienna"
    );
    const end = moment.tz(
      `${ev.date} ${ev.endTime}`,
      "YYYY-MM-DD HH:mm",
      "Europe/Vienna"
    );

    calendar.createEvent({
      start,
      end,
      summary: ev.courseName,
      description: `${ev.courseName} | Lecturer: ${ev.lecturer} | Info: ${
        ev.info || ""
      }`,
      location: ev.room || "",
    });
  }

  return calendar;
}

/**
 * Route: GET /calendar/:pkz.ics
 */
app.get("/calendar/:pkz.ics", async (req: Request, res: Response) => {
  const { pkz } = req.params;

  // fetch from today to +12 months
  const today = new Date();
  const startDate = today.toLocaleDateString("de-DE"); // DD.MM.YYYY
  const endDate = new Date(
    today.setMonth(today.getMonth() + 12)
  ).toLocaleDateString("de-DE");

  try {
    const events = await fetchEvents(startDate, endDate, pkz);
    const calendar = createCalendar(events, pkz);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkz}.ics"`);
    res.send(calendar.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to generate calendar");
  }
});

app.listen(PORT, () => {
  console.log(`📅 Calendar server running at http://localhost:${PORT}`);
});
