import React, { useEffect, useState } from "react";
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
  Paper,
} from "@mui/material";
import ClientInfoPage from "./ClientInfoPage";
import HolidaysPage from "./HolidaysPage";
import ClientDetailsPageWrapper from "./ClientDetailsPageWrapper";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const drawerWidth = 200;

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hent klienter fra backend
  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Sæt din gyldige admin JWT-token her
      const res = await fetch(`${API_URL}/api/clients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        setError("Kunne ikke hente klienter");
      }
    } catch {
      setError("Kunne ikke hente klienter");
    }
    setLoading(false);
  };

  // Godkend klient via backend
  const handleApproveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const token = "PASTE_YOUR_JWT_TOKEN_HERE";
      const res = await fetch(`${API_URL}/api/clients/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke godkende klient");
      }
    } catch {
      setError("Kunne ikke godkende klient");
    }
    setLoading(false);
  };

  // Fjern klient via backend
  const handleRemoveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const token = "PASTE_YOUR_JWT_TOKEN_HERE";
      const res = await fetch(`${API_URL}/api/clients/${id}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke fjerne klient");
      }
    } catch {
      setError("Kunne ikke fjerne klient");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line
  }, []);

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

  const pendingClients = clients.filter(c => c.status === "pending" || c.apiStatus === "pending");

  // Dialog handlers
  const handleOpenApproveDialog = () => setOpenDialog(true);
  const handleCloseDialog = () => setOpenDialog(false);

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
        {error && <Typography color="error">{error}</Typography>}
        {loading && <Typography>Indlæser...</Typography>}
        <Routes>
          <Route
            path="clients"
            element={
              <Box sx={{ position: "relative", minHeight: "100vh" }}>
                <Paper sx={{ position: "relative", p: 0, pb: 6, boxShadow: "none" }}>
                  <Box>
                    <ClientInfoPage
                      clients={clients}
                      onRemoveClient={handleRemoveClient}
                      onApproveClient={handleApproveClient}
                      setClients={setClients}
                      loading={loading}
                    />
                  </Box>
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
                              <TableCell>{client.name || client.unique_id}</TableCell>
                              <TableCell>
                                <Button
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleApproveClient(client.id)}
                                  disabled={loading}
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
