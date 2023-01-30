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

# -------------------------------
# Build k6 binary with extensions
# -------------------------------
FROM golang:1.18-alpine as k6-build
WORKDIR $GOPATH/src/go.k6.io/k6

RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build v0.40.0 --with github.com/Dynatrace/xk6-output-dynatrace@latest --output /k6

# ---
# Run
# ---
FROM loadimpact/k6
COPY --from=k6-build /k6 /usr/bin/k6
ENV WORKDIR=/home/k6

WORKDIR ${WORKDIR}

USER root
RUN apk add --no-cache aws-cli

USER k6

RUN mkdir ${WORKDIR}/scripts
COPY --from=node-build /home/node/scripts/dist ${WORKDIR}/scripts

ENTRYPOINT ["sh"]
