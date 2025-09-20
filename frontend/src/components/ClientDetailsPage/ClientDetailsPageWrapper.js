import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient, getMarkedDays, getCurrentSeason } from "../../api";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

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

      setMarkedDays({ ...calendarData?.markedDays });

    } catch (err) {
      setMarkedDays({});
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(() => fetchAllData(false), 15000);
    return () => clearInterval(timer);
  }, [clientId]);

  // VIGTIGT: Denne tager ikke længere en callback, men viser snackbar direkte
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
    setSnackbar({ open: true, message: "Data opdateret!", severity: "success" });
    setStreamKey(k => k + 1); // Genstart stream sammen med opdatering
  };

  const handleRestartStream = () => {
    setStreamKey(k => k + 1);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
      markedDays={markedDays}
      calendarLoading={calendarLoading}
      streamKey={streamKey}
      onRestartStream={handleRestartStream}
      snackbar={snackbar}
      handleCloseSnackbar={handleCloseSnackbar}
    />
  );
}
