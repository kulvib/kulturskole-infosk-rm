import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getHolidays, addHoliday } from "../api/api";

function HolidaysPage() {
  const { token } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");

  function load() {
    getHolidays(token).then(setHolidays);
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line
  }, [token]);

  async function handleAdd(e) {
    e.preventDefault();
    await addHoliday(token, { date, description: desc });
    setDate(""); setDesc("");
    load();
  }

  return (
    <div>
      <form onSubmit={handleAdd}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input placeholder="Beskrivelse" value={desc} onChange={e => setDesc(e.target.value)} />
        <button type="submit">Tilføj fridag</button>
      </form>
      <ul>
        {holidays.map(h => (
          <li key={h.id}>
            {h.date.slice(0,10)}: {h.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HolidaysPage;
