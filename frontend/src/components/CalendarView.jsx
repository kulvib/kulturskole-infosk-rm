import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const API_URL = "https://din-backend-url/holidays/";

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error("Fejl ved hentning af kalenderdata:", err));
  }, []);

  // Eksempel: Markerede datoer
  const tileClassName = ({ date, view }) => {
    if (
      events.find(
        event =>
          new Date(event.date).toDateString() === date.toDateString()
      )
    ) {
      return "highlight";
    }
  };

  return (
    <div>
      <h2>Kalender</h2>
      <Calendar
        value={date}
        onChange={setDate}
        tileClassName={tileClassName}
      />
      <ul>
        {events
          .filter(event => new Date(event.date).toDateString() === date.toDateString())
          .map(event => (
            <li key={event.id}>{event.title || "Feriedag"}</li>
          ))}
      </ul>
    </div>
  );
}
