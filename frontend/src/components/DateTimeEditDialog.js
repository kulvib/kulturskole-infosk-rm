import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

function formatDateLong(dateStr) {
  if (!dateStr) return "";
  const months = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december"
  ];
  const [year, month, day] = dateStr.split("-");
  const monthName = months[parseInt(month, 10) - 1];
  return `${parseInt(day, 10)}. ${monthName} ${year}`;
}

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  customTime,
  defaultTimes,
  onSave,
}) {
  const [onTime, setOnTime] = React.useState(customTime?.onTime || defaultTimes.onTime);
  const [offTime, setOffTime] = React.useState(customTime?.offTime || defaultTimes.offTime);

  React.useEffect(() => {
    setOnTime(customTime?.onTime || defaultTimes.onTime);
    setOffTime(customTime?.offTime || defaultTimes.offTime);
    // eslint-disable-next-line
  }, [open, date, customTime, defaultTimes]);

  const handleSave = () => {
    onSave({ clientId, date, onTime, offTime });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Tilpas tænd/sluk-tid for {formatDateLong(date)}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" mb={2}>
          Standard: {defaultTimes.onTime} - {defaultTimes.offTime}
        </Typography>
        <TextField
          label="Tænd-tid"
          type="time"
          value={onTime}
          onChange={e => setOnTime(e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{ inputProps: { step: 300 } }}
        />
        <TextField
          label="Sluk-tid"
          type="time"
          value={offTime}
          onChange={e => setOffTime(e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{ inputProps: { step: 300 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuller</Button>
        <Button onClick={handleSave} variant="contained">Gem</Button>
      </DialogActions>
    </Dialog>
  );
}
