# -----------------------
# Typescript > Javascript
# -----------------------
FROM node:16-alpine3.16 as node-build

ENV WORKDIR=/home/node

ADD scripts ${WORKDIR}/scripts

WORKDIR ${WORKDIR}
RUN cd scripts && \
    npm install && \
    node ./build.js

# -----------------------
# OpenTelemetry Collector
# -----------------------
FROM otel/opentelemetry-collector-contrib:0.70.0 as otel
ADD otel-config-template.yaml /etc/otelcol/config-template.yaml

# ---
# Run
# ---
FROM loadimpact/k6
COPY --from=otel / /otel
ENV K6_STATSD_ENABLE_TAGS=true
ENV OTEL_TEMPLATE=/otel/etc/otelcol/config-template.yaml
ENV OTEL_CONFIG=/home/k6/config.yaml
ENV WORKDIR=/home/k6

WORKDIR ${WORKDIR}
USER k6

RUN mkdir ${WORKDIR}/scripts
COPY --from=node-build /home/node/scripts/dist ${WORKDIR}/scripts

ENTRYPOINT ["sh"]
