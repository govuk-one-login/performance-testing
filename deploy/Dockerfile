# -----------------------
# Typescript > Javascript
# -----------------------
FROM node:20-alpine3.18 AS node-build

ENV WORKDIR=/home/node

COPY scripts ${WORKDIR}/scripts

WORKDIR ${WORKDIR}/scripts

RUN npm install --ignore-scripts \
  && npm start

# -------------------------------
# Build k6 binary with extensions
# -------------------------------
FROM golang:1.25-alpine AS k6-build
WORKDIR $GOPATH/src/go.k6.io/k6

RUN go install go.k6.io/xk6/cmd/xk6@v0.13.0 \
  && xk6 build v1.4.2 --with github.com/LeonAdato/xk6-output-statsd@v0.2.1 --output /k6

# -----------------------
# OpenTelemetry Collector
# -----------------------
FROM otel/opentelemetry-collector-contrib:0.141.0 AS otel
COPY otel-config-template.yaml /etc/otelcol/config-template.yaml

# ---
# Run
# ---
FROM grafana/k6:1.4.2
COPY --from=k6-build /k6 /usr/bin/k6
COPY --from=otel / /otel
ENV K6_STATSD_ENABLE_TAGS=true
ENV K6_STATSD_BUFFER_SIZE=100
ENV K6_STATSD_PUSH_INTERVAL=100ms
ENV K6_SUMMARY_TIME_UNIT=ms
ENV K6_SUMMARY_TREND_STATS=avg,min,med,p(95),p(99),max
ENV K6_SYSTEM_TAGS=status,method,group,check,error,scenario
ENV K6_WEB_DASHBOARD=true
ENV K6_WEB_DASHBOARD_EXPORT=report.html
ENV OTEL_METRIC_EXPORT_INTERVAL=100
ENV OTEL_TEMPLATE=/otel/etc/otelcol/config-template.yaml
ENV OTEL_CONFIG=/home/k6/config.yaml
ENV WORKDIR=/home/k6

WORKDIR ${WORKDIR}

USER root
RUN apk add --no-cache aws-cli chromium curl jq

USER k6
RUN mkdir ${WORKDIR}/scripts
COPY --from=node-build /home/node/scripts/dist ${WORKDIR}/scripts
COPY reporting ${WORKDIR}/reporting

ENTRYPOINT ["sh"]
