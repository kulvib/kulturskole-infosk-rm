import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ClientDetailsPage from "./ClientDetailsPage";
import { getClient, getMarkedDays } from "../../api";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const clientData = await getClient(clientId);
      setClient(clientData);

      // Hent markedDays for klienten
      const season = clientData.season || "";
      const markedDaysData = await getMarkedDays(season, clientId);

      // PATCH: Sæt altid ny reference!
      setMarkedDays({ ...markedDaysData.markedDays });

    } catch (err) {
      setClient(null);
      setMarkedDays({});
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [clientId]);

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={fetchData}
      markedDays={markedDays}
    />
  );
}
