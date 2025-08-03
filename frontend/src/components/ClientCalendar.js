import React, { useState } from "react";
export default function ClientCalendar({ client, onSave }) {
  const [calendar, setCalendar] = useState(client.calendar || {});

  const handleChange = (day, field, value) => {
    setCalendar({
      ...calendar,
      [day]: { ...calendar[day], [field]: value },
    });
  };

  return (
    <div>
      {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(day => (
        <div key={day}>
          <label>{day}:</label>
          <input
            type="time"
            value={calendar[day]?.on || ""}
            onChange={e => handleChange(day, "on", e.target.value)}
            placeholder="Tænd"
          />
          <input
            type="time"
            value={calendar[day]?.off || ""}
            onChange={e => handleChange(day, "off", e.target.value)}
            placeholder="Sluk"
          />
        </div>
      ))}
      <button onClick={() => onSave(calendar)}>Gem kalender</button>
    </div>
  );
}
