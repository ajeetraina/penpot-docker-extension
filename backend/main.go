package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"
)

var logger = logrus.New()
var dockerClient *client.Client

func main() {
	var socketPath string
	flag.StringVar(&socketPath, "socket", "/run/guest-services/backend.sock", "Unix domain socket to listen on")
	flag.Parse()

	_ = os.RemoveAll(socketPath)

	logger.SetOutput(os.Stdout)

	// Initialize Docker client
	var err error
	dockerClient, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		logger.Fatal("Failed to create Docker client: ", err)
	}
	defer dockerClient.Close()

	logMiddleware := middleware.LoggerWithConfig(middleware.LoggerConfig{
		Skipper: middleware.DefaultSkipper,
		Format: `{"time":"${time_rfc3339_nano}","id":"${id}",` +
			`"method":"${method}","uri":"${uri}",` +
			`"status":${status},"error":"${error}"` +
			`}` + "\n",
		CustomTimeFormat: "2006-01-02 15:04:05.00000",
		Output:           logger.Writer(),
	})

	logger.Infof("Starting Penpot Extension backend on %s\n", socketPath)
	router := echo.New()
	router.HideBanner = true
	router.Use(logMiddleware)
	router.Use(middleware.CORS())

	ln, err := listen(socketPath)
	if err != nil {
		logger.Fatal(err)
	}
	router.Listener = ln

	// API routes
	router.GET("/status", getPenpotStatus)
	router.POST("/start", startPenpot)
	router.POST("/stop", stopPenpot)
	router.POST("/restart", restartPenpot)
	router.GET("/logs/:service", getPenpotLogs)
	router.GET("/services", listPenpotServices)

	logger.Fatal(router.Start(""))
}

func listen(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}

// Response structures
type ServiceStatus struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	State  string `json:"state"`
	Health string `json:"health"`
	Ports  string `json:"ports"`
}

type PenpotStatus struct {
	Running  bool            `json:"running"`
	Services []ServiceStatus `json:"services"`
	Message  string          `json:"message"`
}

type HTTPMessageBody struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func getPenpotStatus(ctx echo.Context) error {
	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("name", "penpot-"),
		),
	})

	if err != nil {
		logger.Error("Failed to list containers: ", err)
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to get Penpot status",
		})
	}

	// Filter out the extension backend container from the list
	penpotContainers := make([]types.Container, 0)
	for _, c := range containers {
		name := strings.TrimPrefix(c.Names[0], "/")
		if name != "penpot-extension-backend" {
			penpotContainers = append(penpotContainers, c)
		}
	}

	if len(penpotContainers) == 0 {
		return ctx.JSON(http.StatusOK, HTTPMessageBody{
			Success: true,
			Data: PenpotStatus{
				Running:  false,
				Services: []ServiceStatus{},
				Message:  "Penpot is not deployed. Click Start to deploy.",
			},
		})
	}

	services := make([]ServiceStatus, 0)
	runningCount := 0

	for _, c := range penpotContainers {
		name := strings.TrimPrefix(c.Names[0], "/")

		ports := ""
		if len(c.Ports) > 0 {
			portStrings := make([]string, 0)
			for _, port := range c.Ports {
				if port.PublicPort > 0 {
					portStrings = append(portStrings, fmt.Sprintf("%d:%d", port.PublicPort, port.PrivatePort))
				}
			}
			ports = strings.Join(portStrings, ", ")
		}

		health := "N/A"
		if c.State == "running" {
			runningCount++
			// Check health status if available
			inspect, err := dockerClient.ContainerInspect(context.Background(), c.ID)
			if err == nil && inspect.State.Health != nil {
				health = inspect.State.Health.Status
			}
		}

		services = append(services, ServiceStatus{
			Name:   name,
			Status: c.Status,
			State:  c.State,
			Health: health,
			Ports:  ports,
		})
	}

	isRunning := runningCount > 0

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Data: PenpotStatus{
			Running:  isRunning,
			Services: services,
			Message:  fmt.Sprintf("%d of %d services running", runningCount, len(penpotContainers)),
		},
	})
}

func startPenpot(ctx echo.Context) error {
	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("name", "penpot-"),
		),
	})

	if err != nil {
		logger.Error("Failed to list containers: ", err)
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to start Penpot",
		})
	}

	// Filter out the extension backend container
	penpotContainers := make([]types.Container, 0)
	for _, c := range containers {
		name := strings.TrimPrefix(c.Names[0], "/")
		if name != "penpot-extension-backend" {
			penpotContainers = append(penpotContainers, c)
		}
	}

	// If no Penpot service containers exist, deploy with docker compose
	if len(penpotContainers) == 0 {
		logger.Info("No Penpot containers found, deploying with docker compose...")
		cmd := exec.Command("docker", "compose", "-f", "/penpot-compose.yaml", "-p", "penpot", "up", "-d")
		output, err := cmd.CombinedOutput()
		if err != nil {
			logger.Errorf("Failed to deploy Penpot: %v, output: %s", err, string(output))
			return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
				Success: false,
				Message: fmt.Sprintf("Failed to deploy Penpot: %s", string(output)),
			})
		}
		logger.Info("Penpot deployed successfully")
		return ctx.JSON(http.StatusOK, HTTPMessageBody{
			Success: true,
			Message: "Penpot deployed successfully. Services are starting...",
		})
	}

	// Start existing stopped containers
	startedCount := 0
	for _, c := range penpotContainers {
		if c.State != "running" {
			err := dockerClient.ContainerStart(context.Background(), c.ID, types.ContainerStartOptions{})
			if err != nil {
				logger.Errorf("Failed to start container %s: %v", c.Names[0], err)
			} else {
				startedCount++
			}
		}
	}

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Message: fmt.Sprintf("Started %d Penpot service(s)", startedCount),
	})
}

func stopPenpot(ctx echo.Context) error {
	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("name", "penpot-"),
		),
	})

	if err != nil {
		logger.Error("Failed to list containers: ", err)
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to stop Penpot",
		})
	}

	stoppedCount := 0
	timeout := 10
	stopOpts := container.StopOptions{Timeout: &timeout}
	for _, c := range containers {
		name := strings.TrimPrefix(c.Names[0], "/")
		// Don't stop the extension backend
		if name == "penpot-extension-backend" {
			continue
		}
		if c.State == "running" {
			err := dockerClient.ContainerStop(context.Background(), c.ID, stopOpts)
			if err != nil {
				logger.Errorf("Failed to stop container %s: %v", c.Names[0], err)
			} else {
				stoppedCount++
			}
		}
	}

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Message: fmt.Sprintf("Stopped %d Penpot service(s)", stoppedCount),
	})
}

func restartPenpot(ctx echo.Context) error {
	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("name", "penpot-"),
		),
	})

	if err != nil {
		logger.Error("Failed to list containers: ", err)
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to restart Penpot",
		})
	}

	restartedCount := 0
	timeout := 10
	stopOpts := container.StopOptions{Timeout: &timeout}
	for _, c := range containers {
		name := strings.TrimPrefix(c.Names[0], "/")
		// Don't restart the extension backend
		if name == "penpot-extension-backend" {
			continue
		}
		err := dockerClient.ContainerRestart(context.Background(), c.ID, stopOpts)
		if err != nil {
			logger.Errorf("Failed to restart container %s: %v", c.Names[0], err)
		} else {
			restartedCount++
		}
	}

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Message: fmt.Sprintf("Restarted %d Penpot service(s)", restartedCount),
	})
}

func getPenpotLogs(ctx echo.Context) error {
	serviceName := ctx.Param("service")

	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("name", serviceName),
		),
	})

	if err != nil || len(containers) == 0 {
		return ctx.JSON(http.StatusNotFound, HTTPMessageBody{
			Success: false,
			Message: fmt.Sprintf("Service %s not found", serviceName),
		})
	}

	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "100",
	}

	logs, err := dockerClient.ContainerLogs(context.Background(), containers[0].ID, options)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to get logs",
		})
	}
	defer logs.Close()

	buf := new(strings.Builder)
	_, err = io.Copy(buf, logs)
	if err != nil {
		return ctx.JSON(http.StatusInternalServerError, HTTPMessageBody{
			Success: false,
			Message: "Failed to read logs",
		})
	}

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Data:    buf.String(),
	})
}

func listPenpotServices(ctx echo.Context) error {
	services := []map[string]string{
		{"name": "penpot-frontend", "description": "Frontend web interface"},
		{"name": "penpot-backend", "description": "Backend API server"},
		{"name": "penpot-exporter", "description": "Export service for rendering"},
		{"name": "penpot-postgres", "description": "PostgreSQL database"},
		{"name": "penpot-valkey", "description": "Valkey cache service"},
		{"name": "penpot-mailcatch", "description": "Mail catcher for development"},
	}

	return ctx.JSON(http.StatusOK, HTTPMessageBody{
		Success: true,
		Data:    services,
	})
}
