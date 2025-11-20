# 🎨 Penpot Docker Extension

A Docker Desktop extension for deploying and managing a self-hosted Penpot instance. Penpot is an open-source design and prototyping platform for cross-domain teams.


## 🌟 Features

- **One-Click Deployment**: Start a complete Penpot stack with a single click
- **Status Monitoring**: Real-time status of all Penpot services
- **Service Management**: Start, stop, and restart individual services
- **Logs Viewer**: View logs for any Penpot service
- **Quick Access**: Direct links to Penpot UI and MailCatcher
- **Health Checks**: Monitor the health status of all services

## 📋 Prerequisites

- Docker Desktop 4.8.0 or later
- Minimum 4GB RAM available for Docker
- Ports 9001 and 1080 available on your host

## 🚀 Installation

### Option 1: Install from Docker Hub (Coming Soon)

```bash
docker extension install ajeetraina777/penpot-docker-extension:latest
```

### Option 2: Build and Install Locally

1. Clone this repository:
```bash
git clone https://github.com/ajeetraina/penpot-docker-extension.git
cd penpot-docker-extension
```

2. Build the extension:
```bash
make build-extension
```

3. Install the extension:
```bash
make install-extension
```

## 🎯 Getting Started

1. **Open Docker Desktop** and navigate to the Extensions tab
2. **Find Penpot** in the list of installed extensions
3. **Click Start** to launch all Penpot services
4. **Wait** for all services to become healthy (first launch may take 2-3 minutes)
5. **Access Penpot** at http://localhost:9001
6. **Register** a new account
7. **Check MailCatcher** at http://localhost:1080 for confirmation emails

## 📦 What's Included

The extension deploys a complete Penpot stack with the following services:

- **penpot-frontend**: Web interface (Port 9001)
- **penpot-backend**: API server
- **penpot-exporter**: Export and rendering service
- **penpot-postgres**: PostgreSQL database
- **penpot-valkey**: Cache service (Redis-compatible)
- **penpot-mailcatch**: Email testing service (Port 1080)

## 🔧 Configuration

### Default Settings

The extension uses development-friendly defaults:
- Email verification is disabled
- Secure session cookies are disabled (for localhost)
- MailCatcher is used as SMTP server
- Telemetry is enabled with "docker-extension" referer

### Customizing Configuration

To customize Penpot configuration:

1. Stop the Penpot services
2. Edit the `docker-compose.yaml` file in the extension
3. Modify environment variables as needed
4. Restart the services

For production deployments, you should:
- Enable email verification
- Configure a real SMTP server
- Enable secure session cookies
- Set a strong `PENPOT_SECRET_KEY`
- Configure proper SSL/TLS with a reverse proxy

See [Penpot Configuration Guide](https://help.penpot.app/technical-guide/configuration/) for all available options.

## 📊 Service Status

The extension provides real-time monitoring of all services:

- **Running**: Service is active and operational
- **Healthy**: Service health checks are passing
- **Starting**: Service is initializing
- **Stopped**: Service is not running
- **Unhealthy**: Service health checks are failing

## 📝 Viewing Logs

1. Click the **eye icon** next to any service in the services table
2. View the last 100 log lines
3. Use logs to troubleshoot issues

## 🔄 Updating Penpot

To update to the latest Penpot version:

1. Stop all Penpot services
2. Set the `PENPOT_VERSION` environment variable:
   ```bash
   export PENPOT_VERSION=2.4.3
   ```
3. Restart the services

To always use the latest version, leave `PENPOT_VERSION` unset.

## 🛠️ Development

### Frontend Development

```bash
cd ui
npm install
npm run dev
```

Then in another terminal:
```bash
docker extension dev ui-source ajeetraina777/penpot-docker-extension:latest http://localhost:3000
```

### Backend Development

After making changes to `backend/main.go`:
```bash
docker extension update ajeetraina777/penpot-docker-extension:latest
```

### Debug Mode

Enable Chrome DevTools:
```bash
docker extension dev debug ajeetraina777/penpot-docker-extension:latest
```

