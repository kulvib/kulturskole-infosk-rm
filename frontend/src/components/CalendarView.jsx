import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./CalendarView.css";

const API_URL = "https://kulturskole-backend.onrender.com/holidays/"; // Skift til din backend-url

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error("Fejl ved hentning af kalenderdata:", err));
  }, []);

  // Highlighter datoer med events
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      if (
        events.find(
          event =>
            new Date(event.date).toDateString() === date.toDateString()
        )
      ) {
        return "highlight";
      }
    }
    return null;
  };

  // Viser events for valgt dato
  const eventsForDate = events.filter(
    event => new Date(event.date).toDateString() === date.toDateString()
  );

  return (
    <div className="calendar-container">
      <h2>Kalender</h2>
      <Calendar
        value={date}
        onChange={setDate}
        tileClassName={tileClassName}
      />
      <div className="event-list">
        <h3>Events på {date.toLocaleDateString("da-DK")}</h3>
        {eventsForDate.length === 0 ? (
          <p>Ingen events på denne dag.</p>
        ) : (
          <ul>
            {eventsForDate.map(event => (
              <li key={event.id || event.date}>
                {event.title || "Feriedag"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
