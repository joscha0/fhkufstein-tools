import csv
import argparse
import requests
from datetime import datetime


def convert_to_google_calendar_csv(events, csv_file):
    # Google Calendar expected fieldnames
    fieldnames = [
        "Subject",
        "Start Date",
        "Start Time",
        "End Date",
        "End Time",
        "All Day Event",
        "Description",
        "Location",
        "Private",
    ]

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for event in events:
            # Parse date into MM/DD/YYYY
            date_obj = datetime.strptime(event["date"], "%Y-%m-%d")
            start_date = date_obj.strftime("%m/%d/%Y")
            end_date = start_date  # one-day events

            # Convert 24h time to 12h AM/PM
            start_time = datetime.strptime(
                event["startTime"], "%H:%M"
            ).strftime("%I:%M %p")
            end_time = datetime.strptime(event["endTime"], "%H:%M").strftime(
                "%I:%M %p"
            )

            # Description combines course info, lecturer, additional info
            description = f"{event['courseName']} | Lecturer: {event['lecturer']} | Info: {event.get('info', '')}"

            row = {
                "Subject": event["courseName"],
                "Start Date": start_date,
                "Start Time": start_time,
                "End Date": end_date,
                "End Time": end_time,
                "All Day Event": "False",
                "Description": description,
                "Location": event.get("room", ""),
                "Private": "False",
            }
            writer.writerow(row)


def fetch_events(startDate, endDate, pkz):
    print(f"Fetching events for PKZ {pkz} from {startDate} to {endDate}")
    response = requests.get(f"https://fhapp.fh-kufstein.ac.at/api/infoboard?from={startDate}&until={endDate}&ending=pkz={pkz}&impersonating=null")
    response.raise_for_status()  # Raise if HTTP error
    return response.json()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fetch events from Kufstein API and convert to Google Calendar CSV."
    )
    parser.add_argument("startDate", help="Start date (DD.MM.YYYY)")
    parser.add_argument("endDate", help="End date (DD.MM.YYYY)")
    parser.add_argument("pkz", help="Your PKZ")
    parser.add_argument(
        "-o",
        "--output",
        default="calendar_import.csv",
        help="Output CSV file (default: calendar_import.csv)",
    )
    args = parser.parse_args()

    print("📡 Fetching events from API...")
    events = fetch_events(args.startDate, args.endDate, args.pkz)
    
    print("📝 Converting to Google Calendar CSV...")
    convert_to_google_calendar_csv(events['data'], args.output)

    print(f"✅ Done! Import '{args.output}' into Google Calendar.")