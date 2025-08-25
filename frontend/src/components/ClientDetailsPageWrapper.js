import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";
import ClientCalendarDialog from "./ClientCalendarDialog";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Poll klientdata hver 15 sekunder
  const fetchClient = async (forceUpdate = false) => {
    if (!clientId) return;
    try {
      const data = await getClient(clientId);
      setClient(prev => {
        if (forceUpdate || JSON.stringify(data) !== JSON.stringify(prev)) {
          return data;
        }
        return prev;
      });
    } catch (err) {
      // evt. fejl-håndtering
    }
  };

  useEffect(() => {
    fetchClient();
    const timer = setInterval(() => fetchClient(false), 15000); // 15 sekunder
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [clientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClient(true);
    setRefreshing(false);
  };

  return (
    <>
      <ClientDetailsPage
        client={client}
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        onOpenCalendarDialog={() => setCalendarOpen(true)}
      />
      <ClientCalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        clientId={client?.id}
      />
    </>
  );
}
