import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./CalendarView.css";
import { Card, CardContent, Typography, Box, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import EventNoteIcon from "@mui/icons-material/EventNote";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

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
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 3 }}>
      <Card
        sx={{
          minWidth: 380,
          maxWidth: 500,
          borderRadius: 4,
          boxShadow: 4,
          background: "#f9f9f9",
          mb: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <CalendarMonthIcon color="primary" sx={{ fontSize: 34, mr: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#036" }}>
              Kalender
            </Typography>
          </Box>
          <Calendar
            value={date}
            onChange={setDate}
            tileClassName={tileClassName}
            locale="da-DK"
          />
        </CardContent>
      </Card>
      <Card
        sx={{
          minWidth: 380,
          maxWidth: 500,
          borderRadius: 4,
          boxShadow: 2,
          background: "#fff",
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, color: "#036" }}>
            Events på {date.toLocaleDateString("da-DK")}
          </Typography>
          {eventsForDate.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Ingen events på denne dag.
            </Typography>
          ) : (
            <List>
              {eventsForDate.map(event => (
                <ListItem key={event.id || event.date} disableGutters>
                  <ListItemIcon>
                    <EventNoteIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={event.title || "Feriedag"}
                    secondary={event.description}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
