import React from "react";
import { Grid, Card, CardContent, Box, Typography, Button, Tooltip } from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ClientPowerShortTable from "./ClientPowerShortTable";
import SystemInfoTable from "./SystemInfoTable";
import NetworkInfoTable from "./NetworkInfoTable";

export default function ClientDetailsInfoSection({
  client,
  markedDays,
  calendarDialogOpen,
  setCalendarDialogOpen,
}) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                Kalender
              </Typography>
              <Tooltip title="Vis kalender">
                <span>
                  <Button
                    size="small"
                    variant="text"
                    sx={{
                      minWidth: 0,
                      color: "text.secondary",
                      fontSize: "0.85rem",
                      textTransform: "none",
                      px: 1,
                      verticalAlign: "middle",
                      borderRadius: 8
                    }}
                    onClick={() => setCalendarDialogOpen(true)}
                  >
                    <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <ClientPowerShortTable markedDays={markedDays} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Systeminfo
            </Typography>
            <SystemInfoTable client={client} uptime={client.uptime} lastSeen={client.last_seen} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Netværksinfo
            </Typography>
            <NetworkInfoTable client={client} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
