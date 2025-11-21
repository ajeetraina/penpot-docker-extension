FROM golang:1.24-alpine AS builder
ENV CGO_ENABLED=0
WORKDIR /backend
COPY backend/go.mod .
COPY backend/. .
RUN go mod tidy && go mod download
RUN go build -trimpath -ldflags="-s -w" -o bin/service

FROM --platform=$BUILDPLATFORM node:24-alpine AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="Penpot" \
    org.opencontainers.image.description="Docker Extension for Penpot - Open Source Design Platform" \
    org.opencontainers.image.vendor="Ajeet Singh Raina" \
    com.docker.desktop.extension.api.version="0.4.2" \
    com.docker.desktop.extension.icon="https://raw.githubusercontent.com/ajeetraina/penpot-docker-extension/main/penpot.svg" \
    com.docker.extension.screenshots='[{"alt":"Penpot Dashboard","url":"https://raw.githubusercontent.com/ajeetraina/penpot-docker-extension/main/screenshots/dashboard.png"}]' \
    com.docker.extension.detailed-description="Penpot is the open-source design and prototyping platform for design and code teams. This extension allows you to run Penpot locally with a single click. Features include: self-hosted design platform, real-time collaboration, SVG-based workflow, and full design-to-code capabilities." \
    com.docker.extension.publisher-url="https://github.com/ajeetraina" \
    com.docker.extension.additional-urls='[{"title":"Penpot Website","url":"https://penpot.app"},{"title":"Documentation","url":"https://help.penpot.app"},{"title":"Source Code","url":"https://github.com/ajeetraina/penpot-docker-extension"}]' \
    com.docker.extension.categories="utility-tools" \
    com.docker.extension.changelog="<ul><li>Initial release with Penpot deployment</li><li>Start/Stop/Restart controls</li><li>Service status monitoring</li><li>Log viewing capability</li></ul>"

# Install Docker CLI for compose commands
RUN apk add --no-cache docker-cli docker-cli-compose

COPY --from=builder /backend/bin/service /
COPY docker-compose.yaml .
COPY penpot-compose.yaml .
COPY metadata.json .
COPY docker.svg .
COPY penpot.svg .
COPY --from=client-builder /ui/build ui
CMD ["/service", "-socket", "/run/guest-services/backend.sock"]
