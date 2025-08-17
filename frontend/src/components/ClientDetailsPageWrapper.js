import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient } from "../api";

function isEqualClient(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Hent klientdata fra API
  const fetchClient = async (forceUpdate = false) => {
    if (!clientId) return;
    try {
      const data = await getClient(clientId);
      if (forceUpdate || !isEqualClient(data, client)) {
        setClient(data);
      }
    } catch (err) {
      // evt. fejl-håndtering
    }
  };

  // Polling: hent data hvert 10. sekund
  useEffect(() => {
    fetchClient();
    const timer = setInterval(() => fetchClient(false), 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [clientId]);

  // Funktion til manuel opdatering (knap)
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClient(true); // force update
    setRefreshing(false);
  };

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
    />
  );
}
