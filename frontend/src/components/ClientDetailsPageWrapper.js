import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient } from "../api";
import ClientDetailsPage from "./ClientDetailsPage";

function isEqualClient(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
    />
  );
}
