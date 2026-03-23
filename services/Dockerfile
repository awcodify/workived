FROM golang:1.22-alpine AS builder

# Set Go proxy and environment for better Railway compatibility
ENV GOPROXY=https://proxy.golang.org,direct \
    GOSUMDB=sum.golang.org \
    CGO_ENABLED=0 \
    GOOS=linux

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies with verbose output for debugging
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application
RUN go build -o /api ./cmd/api

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /
COPY --from=builder /api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
