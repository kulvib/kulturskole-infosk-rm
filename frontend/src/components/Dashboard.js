import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ClientInfoPage from "./ClientInfoPage";
import HolidaysPage from "./HolidaysPage";
import ClientDetailsPageWrapper from "./ClientDetailsPageWrapper";

const initialClients = [
  { id: 1, name: "Klient A", locality: "Lokale 1", status: "online", apiStatus: "approved", ip: "192.168.1.101", softwareVersion: "1.4.2", macAddress: "00:1A:2B:3C:4D:5E", lastSeen: "2025-07-28 13:35:00", uptime: "4 dage, 2 timer", kioskWebAddress: "https://kulturskolen-viborg.dk/info", chromeRunning: true, chromeUrl: "https://kulturskolen-viborg.dk/info" },
  { id: 2, name: "Klient B", locality: "Lokale 2", status: "offline", apiStatus: "approved", ip: "192.168.1.102", softwareVersion: "1.4.2", macAddress: "00:1A:2B:3C:4D:5F", lastSeen: "2025-07-28 13:39:10", uptime: "2 dage, 7 timer", kioskWebAddress: "https://kulturskolen-viborg.dk/plan", chromeRunning: false, chromeUrl: "" },
  { id: 3, name: "Klient C", locality: "Lokale 3", status: "online", apiStatus: "pending", ip: "192.168.1.103", softwareVersion: "1.4.2", macAddress: "00:1A:2B:3C:4D:60", lastSeen: "2025-07-28 13:45:02", uptime: "1 dag, 6 timer", kioskWebAddress: "https://kulturskolen-viborg.dk/sal", chromeRunning: false, chromeUrl: "" },
  { id: 4, name: "Klient D", locality: "Lokale 4", status: "offline", apiStatus: "pending", ip: "192.168.1.104", softwareVersion: "1.4.2", macAddress: "00:1A:2B:3C:4D:61", lastSeen: "2025-07-28 13:48:10", uptime: "3 timer", kioskWebAddress: "https://kulturskolen-viborg.dk/undervisning", chromeRunning: false, chromeUrl: "" },
];

const drawerWidth = 200;

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState(initialClients);
  const [openDialog, setOpenDialog] = useState(false);

  // Open approve dialog
  const handleOpenApproveDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleApproveClient = (id) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, apiStatus: "approved" } : c))
    );
  };

  const handleRemoveClient = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

  // Find if there are pending clients
  const pendingClients = clients.filter(c => c.apiStatus === "pending");

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/")}
            color="inherit"
          >
            Kulturskolen Viborg - infoskærme administration
          </Typography>
          <Button color="inherit" sx={{ color: "#fff" }}>
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={location.pathname === item.to}
              sx={{
                color: "black",
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "black",
                  fontWeight: "bold",
                },
              }}
            >
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${drawerWidth}px`,
          position: "relative",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Routes>
          <Route
            path="clients"
            element={
              <Box sx={{ position: "relative", minHeight: "100vh" }}>
                <Paper sx={{ position: "relative", p: 0, pb: 6, boxShadow: "none" }}>
                  <ClientInfoPage
                    clients={clients}
                    onRemoveClient={handleRemoveClient}
                    setClients={setClients}
                  />
                  {/* Mindre grøn "Tilføj klient" knap, placeret under listen i højre hjørne */}
                  {pendingClients.length > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        right: 24,
                        bottom: 16,
                        zIndex: 1201,
                      }}
                    >
                      <Fab
                        variant="extended"
                        color="success"
                        onClick={handleOpenApproveDialog}
                        size="small"
                        sx={{
                          fontWeight: "bold",
                          fontSize: "0.9rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          boxShadow: "0px 3px 10px 1px rgba(76,175,80,0.11)",
                          color: "#fff",
                          height: 32,
                          minHeight: 32,
                          paddingLeft: 1.2,
                          paddingRight: 1.2,
                          '& svg': { fontSize: 18 }
                        }}
                      >
                        <AddIcon sx={{ mr: 1 }} />
                        Tilføj klient
                      </Fab>
                    </Box>
                  )}
                </Paper>
                {/* Modal: Godkend nye klienter */}
                <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                  <DialogTitle>Godkend nye klienter</DialogTitle>
                  <DialogContent>
                    <Table>
                      <TableBody>
                        {pendingClients.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2}>Ingen ikke-godkendte klienter.</TableCell>
                          </TableRow>
                        ) : (
                          pendingClients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell>{client.name}</TableCell>
                              <TableCell>
                                <Button
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleApproveClient(client.id)}
                                >
                                  Godkend
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={handleCloseDialog}>Luk</Button>
                  </DialogActions>
                </Dialog>
              </Box>
            }
          />
          <Route path="clients/:clientId" element={<ClientDetailsPageWrapper clients={clients} />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route
            path="*"
            element={<Typography variant="h5">Velkommen til adminpanelet.</Typography>}
          />
        </Routes>
      </Box>
    </Box>
  );
}
