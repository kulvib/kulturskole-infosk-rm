import React from "react";
import { useParams } from "react-router-dom";
import ClientDetailsPage from "./ClientDetailsPage";

export default function ClientDetailsPageWrapper({ clients }) {
  const { clientId } = useParams();
  return <ClientDetailsPage clients={clients} clientId={clientId} />;
}
