import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Error as ErrorIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { createDockerDesktopClient } from '@docker/extension-api-client';

const client = createDockerDesktopClient();

interface Service {
  name: string;
  status: string;
  state: string;
  health: string;
  ports: string;
}

interface PenpotStatus {
  running: boolean;
  services: Service[];
  message: string;
}

export function App() {
  const [status, setStatus] = useState<PenpotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logsDialog, setLogsDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [logs, setLogs] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  const ddClient = client;

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await ddClient.extension.vm?.service?.get('/status');
      if (result?.data) {
        setStatus(result.data as PenpotStatus);
      }
    } catch (err) {
      setError('Failed to fetch Penpot status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const result = await ddClient.extension.vm?.service?.post('/start', {});
      if (result?.message) {
        ddClient.desktopUI.toast.success(result.message);
      }
      await fetchStatus();
    } catch (err) {
      setError('Failed to start Penpot');
      ddClient.desktopUI.toast.error('Failed to start Penpot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const result = await ddClient.extension.vm?.service?.post('/stop', {});
      if (result?.message) {
        ddClient.desktopUI.toast.success(result.message);
      }
      await fetchStatus();
    } catch (err) {
      setError('Failed to stop Penpot');
      ddClient.desktopUI.toast.error('Failed to stop Penpot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const result = await ddClient.extension.vm?.service?.post('/restart', {});
      if (result?.message) {
        ddClient.desktopUI.toast.success(result.message);
      }
      await fetchStatus();
    } catch (err) {
      setError('Failed to restart Penpot');
      ddClient.desktopUI.toast.error('Failed to restart Penpot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewLogs = async (serviceName: string) => {
    try {
      setSelectedService(serviceName);
      setLogsDialog(true);
      setLogs('Loading logs...');
      const result = await ddClient.extension.vm?.service?.get(`/logs/${serviceName}`);
      if (result?.data) {
        setLogs(result.data as string);
      }
    } catch (err) {
      setLogs('Failed to load logs');
      console.error(err);
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'running':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'exited':
        return <CancelIcon sx={{ color: 'error.main' }} />;
      default:
        return <ErrorIcon sx={{ color: 'warning.main' }} />;
    }
  };

  const getHealthChip = (health: string) => {
    if (health === 'healthy') {
      return <Chip label="Healthy" color="success" size="small" />;
    } else if (health === 'unhealthy') {
      return <Chip label="Unhealthy" color="error" size="small" />;
    } else if (health === 'starting') {
      return <Chip label="Starting" color="warning" size="small" />;
    }
    return <Chip label="N/A" size="small" />;
  };

  const openPenpot = () => {
    ddClient.host.openExternal('http://localhost:9001');
  };

  const openMailCatcher = () => {
    ddClient.host.openExternal('http://localhost:1080');
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
          🎨 Penpot - Self-Hosted Design Platform
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Open-source design and prototyping platform for cross-domain teams
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="h6">Status:</Typography>
                {loading && <CircularProgress size={24} />}
                {!loading && status && (
                  <Chip
                    label={status.running ? 'Running' : 'Stopped'}
                    color={status.running ? 'success' : 'default'}
                    icon={status.running ? <CheckCircleIcon /> : <CancelIcon />}
                  />
                )}
                {status && (
                  <Typography variant="body2" color="text.secondary">
                    {status.message}
                  </Typography>
                )}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStart}
                  disabled={actionLoading || (status?.running ?? false)}
                  color="success"
                >
                  Start
                </Button>
                <Button
                  variant="contained"
                  startIcon={<StopIcon />}
                  onClick={handleStop}
                  disabled={actionLoading || !(status?.running ?? false)}
                  color="error"
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRestart}
                  disabled={actionLoading || !(status?.running ?? false)}
                >
                  Restart
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchStatus}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Access Links */}
      {status?.running && (
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🚀 Quick Access
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                endIcon={<OpenInNewIcon />}
                onClick={openPenpot}
              >
                Open Penpot (Port 9001)
              </Button>
              <Button
                variant="outlined"
                endIcon={<OpenInNewIcon />}
                onClick={openMailCatcher}
              >
                Open MailCatcher (Port 1080)
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              📧 Default login: Check MailCatcher for registration emails (development mode)
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Services Table */}
      {status?.services && status.services.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Services
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Service Name</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Health</TableCell>
                    <TableCell>Ports</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {status.services.map((service) => (
                    <TableRow key={service.name}>
                      <TableCell>{getStatusIcon(service.state)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {service.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={service.status}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{getHealthChip(service.health)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {service.ports || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Logs">
                          <IconButton
                            size="small"
                            onClick={() => handleViewLogs(service.name)}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Getting Started Info */}
      {!status?.running && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📚 Getting Started
            </Typography>
            <Typography variant="body2" paragraph>
              Penpot is an open-source design and prototyping platform. To get started:
            </Typography>
            <ol>
              <li>
                <Typography variant="body2">
                  Click the "Start" button to launch all Penpot services
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Wait for all services to become healthy (this may take a few minutes on first launch)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Access Penpot at{' '}
                  <Link href="http://localhost:9001" target="_blank">
                    http://localhost:9001
                  </Link>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Register a new account - check MailCatcher at{' '}
                  <Link href="http://localhost:1080" target="_blank">
                    http://localhost:1080
                  </Link>{' '}
                  for confirmation emails
                </Typography>
              </li>
            </ol>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              ℹ️ This deployment uses development settings with email verification disabled
              and a mailcatcher service. For production use, configure proper SMTP settings.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Logs Dialog */}
      <Dialog
        open={logsDialog}
        onClose={() => setLogsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Service Logs: {selectedService}
        </DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={20}
            fullWidth
            value={logs}
            variant="outlined"
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
