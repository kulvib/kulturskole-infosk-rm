import React, { useState, useEffect, useRef } from "react";
import { Box, Grid } from "@mui/material";
import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./ClientDetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../CalendarPage/ClientCalendarDialog";
import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClient,
  getSchools,
} from "../../api";

export default function ClientDetailsPage({
  client,
  refreshing,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  showSnackbar
}) {
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status || "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color || null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen || null);
  const [uptime, setUptime] = useState(client?.uptime || null);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [pendingLivestream, setPendingLivestream] = useState(false);

  // Skoler
  const [schools, setSchools] = useState([]);
  const [schoolSelection, setSchoolSelection] = useState(client?.school_id ?? "");
  const [savingSchool, setSavingSchool] = useState(false);
  const [schoolDirty, setSchoolDirty] = useState(false);

  // Robust: Track om bruger interagerer med dropdown
  const userIsSelectingSchool = useRef(false);

  // Polling interval ref
  const pollingRef = useRef();

  useEffect(() => {
    getSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  // Funktion til at hente klientdata fra backend
  const fetchClientData = async () => {
    if (!client?.id) return;
    try {
      const updated = await getClient(client.id);
      const pca = updated.pending_chrome_action;
      setPendingLivestream(
        pca === "livestream_start" || pca === "livestream_stop"
      );
      setLiveChromeStatus(updated.chrome_status || "unknown");
      setLiveChromeColor(updated.chrome_color || null);
      setLastSeen(updated.last_seen || null);
      setUptime(updated.uptime || null);
      // Kun opdater schoolSelection hvis ikke dirty og ikke interagerende
      if (!schoolDirty && !userIsSelectingSchool.current) {
        setSchoolSelection(updated.school_id ?? "");
      }
      // OPTIMISTISK: Opdatér kun locality/kioskUrl hvis ikke dirty!
      if (!localityDirty) setLocality(updated.locality || "");
      if (!kioskUrlDirty) setKioskUrl(updated.kiosk_url || "");
    } catch (err) {
      // ignore errors silently (could log if needed)
    }
  };

  useEffect(() => {
    if (client?.id) {
      fetchClientData();
      pollingRef.current = setInterval(fetchClientData, 1000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line
  }, [client?.id]);

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
      setLiveChromeColor(client.chrome_color || null);
      setLastSeen(client.last_seen || null);
      setUptime(client.uptime || null);
      if (!schoolDirty && !userIsSelectingSchool.current) {
        setSchoolSelection(client.school_id ?? "");
      }
    }
    // eslint-disable-next-line
  }, [client, schoolDirty, localityDirty, kioskUrlDirty]);

  // handleRefresh: genindlæs klientdata og vis snackbar
  const handleRefresh = async () => {
    await fetchClientData();
    if (showSnackbar) showSnackbar({ message: "Klientdata opdateret!", severity: "info" });
  };

  // Locality handlers
  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      const res = await updateClient(client.id, { locality });
      // Forsøg at hente gemt/normaliseret værdi fra respons
      const savedLocality = res?.locality ?? res?.data?.locality ?? locality;
      // Opdater lokal state og nulstil dirty (vi returnerer saved value for child komponenter)
      setLocality(savedLocality);
      setLocalityDirty(false);
      showSnackbar && showSnackbar({ message: "Lokation gemt!", severity: "success" });
      return savedLocality;
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
      throw err;
    } finally {
      setSavingLocality(false);
    }
  };

  // Kiosk URL handlers
  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    setSavingKioskUrl(true);
    try {
      const res = await pushKioskUrl(client.id, kioskUrl);
      const savedUrl = res?.kiosk_url ?? res?.kioskUrl ?? res?.data?.kiosk_url ?? kioskUrl;
      setKioskUrl(savedUrl);
      setKioskUrlDirty(false);
      showSnackbar && showSnackbar({ message: "Kiosk webadresse opdateret!", severity: "success" });
      return savedUrl;
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
      throw err;
    } finally {
      setSavingKioskUrl(false);
    }
  };

  // Når backend har opdateret, og local value matcher backend, reset dirty state (safety net)
  useEffect(() => {
    if (client && localityDirty && locality === (client.locality || "")) {
      setLocalityDirty(false);
    }
    if (client && kioskUrlDirty && kioskUrl === (client.kiosk_url || "")) {
      setKioskUrlDirty(false);
    }
    // eslint-disable-next-line
  }, [client, locality, kioskUrl]);

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      showSnackbar && showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Fejl: " + (err?.message || err), severity: "error" });
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  useEffect(() => {
    if (client?.id) {
      clientAction(client.id, "livestream_start").catch(() => {});
    }
  }, [client?.id]);

  // Skolevælger
  const handleSchoolChange = (schoolId) => {
    setSchoolSelection(schoolId);
    setSchoolDirty(true);
    userIsSelectingSchool.current = true;
  };

  const handleSchoolSave = async () => {
    setSavingSchool(true);
    try {
      const res = await updateClient(client.id, { school_id: schoolSelection });
      const saved = res?.school_id ?? res?.data?.school_id ?? schoolSelection;
      setSchoolDirty(false);
      userIsSelectingSchool.current = false;
      showSnackbar && showSnackbar({ message: "Skolevalg gemt!", severity: "success" });
      return saved;
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke gemme skolevalg: " + (err?.message || err), severity: "error" });
      throw err;
    } finally {
      setSavingSchool(false);
    }
  };

  if (!client) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsHeaderSection
            client={client}
            schools={schools}
            schoolSelection={schoolSelection}
            handleSchoolChange={handleSchoolChange}
            schoolDirty={schoolDirty}
            savingSchool={savingSchool}
            handleSchoolSave={handleSchoolSave}
            locality={locality}
            localityDirty={localityDirty}
            savingLocality={savingLocality}
            handleLocalityChange={handleLocalityChange}
            handleLocalitySave={handleLocalitySave}
            kioskUrl={kioskUrl}
            kioskUrlDirty={kioskUrlDirty}
            savingKioskUrl={savingKioskUrl}
            handleKioskUrlChange={handleKioskUrlChange}
            handleKioskUrlSave={handleKioskUrlSave}
            liveChromeStatus={liveChromeStatus}
            liveChromeColor={liveChromeColor}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsLivestreamSection
            clientId={client?.id}
            key={streamKey}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsInfoSection
            client={client}
            markedDays={markedDays}
            uptime={uptime}
            lastSeen={lastSeen}
            calendarDialogOpen={calendarDialogOpen}
            setCalendarDialogOpen={setCalendarDialogOpen}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsActionsSection
            clientId={client?.id}
            actionLoading={actionLoading}
            handleClientAction={handleClientAction}
            handleOpenTerminal={handleOpenTerminal}
            handleOpenRemoteDesktop={handleOpenRemoteDesktop}
            shutdownDialogOpen={shutdownDialogOpen}
            setShutdownDialogOpen={setShutdownDialogOpen}
          />
        </Grid>
      </Grid>
      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={client.id}
      />
    </Box>
  );
}
