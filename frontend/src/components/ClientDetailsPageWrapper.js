import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient, getMarkedDays, getCurrentSeason } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Hent klientdata og kalenderdata samtidig
  const fetchAllData = async (forceUpdate = false) => {
    if (!clientId) return;
    setCalendarLoading(true);
    try {
      const [clientData, season] = await Promise.all([
        getClient(clientId),
        getCurrentSeason()
      ]);
      const calendarData = await getMarkedDays(season.id, clientId);

      setClient(prev => {
        if (forceUpdate || JSON.stringify(clientData) !== JSON.stringify(prev)) {
          return clientData;
        }
        return prev;
      });
      setMarkedDays(calendarData?.markedDays || {});
    } catch (err) {
      setMarkedDays({});
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(() => fetchAllData(false), 15000); // 15 sekunder
    return () => clearInterval(timer);
  }, [clientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
  };

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
      markedDays={markedDays}
      calendarLoading={calendarLoading}
    />
  );
}
