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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableRow,
  TableCell,
  DialogActions,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from "@mui/material";
import ClientInfoPage from "./ClientInfoPage";
import HolidaysPage from "./HolidaysPage";
import ClientDetailsPageWrapper from "./ClientDetailsPageWrapper";

const drawerWidth = 200;

export default function Dashboard(props) {
  const {
    clients,
    setClients,
    loading,
    error,
    onApproveClient,
    onRemoveClient,
    holidays,
    holidayDate,
    setHolidayDate,
    holidayDesc,
    setHolidayDesc,
    setHolidays,
    handleAddHoliday,
    handleDeleteHoliday,
    fetchClients,
    fetchHolidays,
  } = props;

  const location = useLocation();
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  // Start altid med klienter (tab 0)
  const [tab, setTab] = useState(0);

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

  const pendingClients = clients.filter(
    (c) => c.status === "pending" || c.apiStatus === "pending"
  );

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
          <Button color="inherit" sx={{ color: "#fff" }} onClick={() => window.location.reload()}>
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
          {menuItems.map((item, idx) => (
            <ListItem
              button
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={tab === idx}
              sx={{
                color: "black",
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "black",
                  fontWeight: "bold",
                },
              }}
              onClick={() => setTab(idx)}
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
        {error && (
          <Snackbar open autoHideDuration={3000} onClose={() => {}}>
            <Alert severity="error">{error}</Alert>
          </Snackbar>
        )}
        {loading && <Typography>Indlæser...</Typography>}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 3 }}
        >
          <Tab label="Klienter" />
          <Tab label="Helligdage" />
        </Tabs>
        {tab === 0 && (
          <ClientInfoPage
            clients={clients}
            onRemoveClient={onRemoveClient}
            onApproveClient={onApproveClient}
            setClients={setClients}
            loading={loading}
            fetchClients={fetchClients}
            navigate={navigate}
          />
        )}
        {tab === 1 && (
          <HolidaysPage
            holidays={holidays}
            holidayDate={holidayDate}
            setHolidayDate={setHolidayDate}
            holidayDesc={holidayDesc}
            setHolidayDesc={setHolidayDesc}
            setHolidays={setHolidays}
            loading={loading}
            handleAddHoliday={handleAddHoliday}
            handleDeleteHoliday={handleDeleteHoliday}
            fetchHolidays={fetchHolidays}
          />
        )}
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
                          onClick={() => onApproveClient(client.id)}
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
        <Routes>
          <Route path="clients/:clientId" element={<ClientDetailsPageWrapper clients={clients} />} />
          <Route path="holidays" element={<HolidaysPage
            holidays={holidays}
            holidayDate={holidayDate}
            setHolidayDate={setHolidayDate}
            holidayDesc={holidayDesc}
            setHolidayDesc={setHolidayDesc}
            setHolidays={setHolidays}
            loading={loading}
            handleAddHoliday={handleAddHoliday}
            handleDeleteHoliday={handleDeleteHoliday}
            fetchHolidays={fetchHolidays}
          />} />
          <Route
            path="*"
            element={<Typography variant="h5">Velkommen til adminpanelet.</Typography>}
          />
        </Routes>
      </Box>
    </Box>
  );
}
