import React, { useState } from "react";
import DateTimeEditDialog from "./DateTimeEditDialog";

// Du skal have DateTimeEditDialog.js fra tidligere svar i samme directory!

export default function TimeEditTest() {
  // Dummy data til test; normalt får du dette fra din API
  const [markedDays, setMarkedDays] = useState({
    "2025-08-02": { status: "on", onTime: "08:02", offTime: "18:02" }
  });
  const defaultTimes = { onTime: "08:00", offTime: "18:00" };
  const [date] = useState("2025-08-02");
  const [open, setOpen] = useState(false);

  // Disse to værdier skal du normalt hente fra din app-context/api
  const clients = ["abc"];
  const season = "2025";

  // Her simuleres et API-kald:
  const handleSave = ({ date, onTime, offTime }) => {
    // Opdaterer lokal state
    setMarkedDays(prev => ({
      ...prev,
      [date]: { ...prev[date], onTime, offTime }
    }));

    // Byg payload til API som backend kræver
    const payload = {
      markedDays: {
        [date]: {
          onTime,
          offTime,
          status: "on"
        }
      },
      clients,
      season
    };

    // Her ville du normalt lave et fetch/axios-kald
    console.log("Payload der sendes til API:", payload);
    setOpen(false);
  };

  return (
    <div>
      <button onClick={() => setOpen(true)}>
        Redigér tid for {date}
      </button>
      <DateTimeEditDialog
        open={open}
        onClose={() => setOpen(false)}
        date={date}
        clientId="abc"
        customTime={markedDays[date]}
        defaultTimes={defaultTimes}
        onSave={handleSave}
      />
    </div>
  );
}
