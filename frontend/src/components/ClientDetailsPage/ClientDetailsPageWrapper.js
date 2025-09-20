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

  const handleRefresh = async (onSuccess) => {
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
    if (onSuccess) onSuccess();
  };

  const handleRestartStream = () => {
    setStreamKey(k => k + 1);
  };

  const handleShowSnackbar = (snackbarUpdate) => {
    setSnackbar({ ...snackbar, ...snackbarUpdate });
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
