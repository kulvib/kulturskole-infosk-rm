import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import { getClients, getHolidays } from "./api"; // Tilføj dine API-funktioner her

export default function App() {
  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  // ... resten af dine states

  // Hent klienter
  const fetchClients = async () => {
    try {
      setClients(await getClients());
    } catch {
      // error handling
    }
  };

  // Hent helligdage
  const fetchHolidays = async () => {
    try {
      setHolidays(await getHolidays());
    } catch {
      // error handling
    }
  };

  // ... resten af dine metoder - brug api.js funktionerne

  useEffect(() => {
    fetchClients();
    fetchHolidays();
    // eslint-disable-next-line
  }, []);

  // ... resten af din komponent
}
